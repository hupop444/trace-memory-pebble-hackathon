/* Fast preview scene built from validated STL artifacts. */
variant = is_undef(variant) ? "bag_esp32" : variant;
view = is_undef(view) ? "front" : view;
explode = is_undef(explode) ? 0 : explode;
show_internals = is_undef(show_internals) ? false : show_internals;

module stl_assembly() {
    color([0.87,0.89,0.88,0.42])
        translate([0,0,-explode]) import(str("../exports/TRACE_",variant,"_back.stl"));
    color([0.93,0.92,0.89,0.52])
        translate([0,0,explode]) import(str("../exports/TRACE_",variant,"_front.stl"));
    if (show_internals) {
        color([0.04,0.34,0.23,0.82]) import(str("../exports/TRACE_",variant,"_board.stl"));
        color([0.96,0.56,0.12,1.0]) import(str("../exports/TRACE_",variant,"_sensor.stl"));
    }
}

if (view=="front") rotate([90,0,0]) stl_assembly();
if (view=="rear") rotate([90,0,180]) stl_assembly();
if (view=="side") rotate([90,0,90]) stl_assembly();
