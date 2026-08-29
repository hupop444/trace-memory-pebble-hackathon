"""Dependency-free structural QA for ASCII STL exports."""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
EXPORTS = ROOT / "exports"


def parse_args():
    parser = argparse.ArgumentParser(description="Validate printable ASCII STL files.")
    parser.add_argument("--input-dir", type=Path, default=EXPORTS)
    parser.add_argument("--pattern", default="TRACE_*.stl")
    parser.add_argument(
        "--report",
        type=Path,
        default=EXPORTS / "TRACE_validation_report.json",
    )
    return parser.parse_args()


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def parse_ascii_stl(path: Path):
    faces = []
    current = []
    for raw in path.read_text(encoding="ascii", errors="strict").splitlines():
        line = raw.strip()
        if line.startswith("vertex "):
            current.append(tuple(float(value) for value in line.split()[1:4]))
            if len(current) == 3:
                faces.append(tuple(current))
                current = []
    if not faces:
        raise ValueError(f"No triangles in {path}")
    return faces


def qvertex(vertex):
    return tuple(round(value, 5) for value in vertex)


def analyze(path: Path):
    faces = parse_ascii_stl(path)
    edge_counts = defaultdict(int)
    vertex_to_faces = defaultdict(list)
    degenerate = 0
    signed_volume = 0.0
    points = []
    for face_index, face in enumerate(faces):
        qface = tuple(qvertex(v) for v in face)
        points.extend(face)
        for vertex in qface:
            vertex_to_faces[vertex].append(face_index)
        for index in range(3):
            edge = tuple(sorted((qface[index], qface[(index + 1) % 3])))
            edge_counts[edge] += 1
        normal = cross(sub(face[1], face[0]), sub(face[2], face[0]))
        # ASCII STL rounds coordinates; only flag genuinely collapsed facets,
        # not micron-scale CGAL slivers that retain a non-zero normal.
        if dot(normal, normal) < 1e-22:
            degenerate += 1
        signed_volume += dot(face[0], cross(face[1], face[2])) / 6.0

    seen = set()
    component_sizes = []
    for start in range(len(faces)):
        if start in seen:
            continue
        queue = [start]
        seen.add(start)
        size = 0
        while queue:
            face_index = queue.pop()
            size += 1
            for vertex in faces[face_index]:
                for neighbour in vertex_to_faces[qvertex(vertex)]:
                    if neighbour not in seen:
                        seen.add(neighbour)
                        queue.append(neighbour)
        component_sizes.append(size)

    lo = [min(p[axis] for p in points) for axis in range(3)]
    hi = [max(p[axis] for p in points) for axis in range(3)]
    edge_histogram = defaultdict(int)
    for incidence in edge_counts.values():
        edge_histogram[incidence] += 1
    return {
        "triangles": len(faces),
        "components": len(component_sizes),
        "component_triangles": sorted(component_sizes, reverse=True),
        "watertight": all(count == 2 for count in edge_counts.values()),
        "edge_incidence_histogram": dict(sorted(edge_histogram.items())),
        "degenerate_triangles": degenerate,
        "bounds_mm": {
            "min": [round(v, 4) for v in lo],
            "max": [round(v, 4) for v in hi],
            "size": [round(hi[i] - lo[i], 4) for i in range(3)],
        },
        "signed_volume_mm3": round(signed_volume, 3),
        "file_bytes": path.stat().st_size,
    }


def main():
    args = parse_args()
    paths = sorted(args.input_dir.glob(args.pattern))
    if not paths:
        raise SystemExit(
            f"QA failed: no STL files matched {args.pattern!r} in {args.input_dir}"
        )

    report = {}
    failures = []
    for path in paths:
        result = analyze(path)
        report[path.name] = result
        is_print_part = not path.name.endswith("_board.stl")
        if is_print_part and (
            not result["watertight"]
            or result["components"] != 1
            or result["degenerate_triangles"] != 0
        ):
            failures.append(path.name)
        print(
            f"{path.name}: watertight={result['watertight']} "
            f"components={result['components']} triangles={result['triangles']} "
            f"size={result['bounds_mm']['size']}"
        )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if failures:
        raise SystemExit("QA failed: " + ", ".join(failures))
    print("QA PASS: all printable parts are watertight, non-degenerate single components")


if __name__ == "__main__":
    main()
