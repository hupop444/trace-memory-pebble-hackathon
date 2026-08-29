// TRACE full-size ESP32-S3 prototype enclosure. All values are millimeters.
part = 0; // 0 = assembly, 1 = base, 2 = lid

board_length = 68.0;
board_width = 28.0;
board_clearance = 2.0;

wall = 2.4;
floor_thickness = 2.0;
corner_radius = 8.0;
fit_clearance = 0.35;

shell_length = 82.0;
shell_width = 44.0;
base_height = 17.0;
lid_top_thickness = 2.0;
lid_lip_height = 4.0;
lid_lip_wall = 1.6;

usb_window_width = 24.0;
usb_window_height = 10.0;
usb_window_bottom = 3.0;

fsr_pocket_diameter = 22.0;
fsr_pocket_depth = 1.0;
pressure_pad_length = 30.0;
pressure_pad_width = 24.0;
pressure_pad_height = 1.2;

lanyard_hole_diameter = 5.0;
lanyard_lug_length = 10.0;
lanyard_lug_width = 18.0;
lanyard_lug_height = 4.0;

$fn = 64;

assert(shell_length > board_length + 2 * wall + board_clearance);
assert(shell_width > board_width + 2 * wall + board_clearance);
assert(base_height > floor_thickness + 5);

module rounded_prism(length, width, height, radius) {
    linear_extrude(height = height)
        offset(r = radius)
            square([length - 2 * radius, width - 2 * radius], center = true);
}

module trace_base() {
    inner_length = shell_length - 2 * wall;
    inner_width = shell_width - 2 * wall;
    lug_center_x = -shell_length / 2 - lanyard_lug_length / 2 + 2;
    rail_length = min(board_length - 6, inner_length - 10);
    rail_offset_y = board_width / 2 + board_clearance / 2;

    union() {
        difference() {
            union() {
                rounded_prism(shell_length, shell_width, base_height, corner_radius);
                translate([lug_center_x, 0, 0])
                    rounded_prism(lanyard_lug_length, lanyard_lug_width, lanyard_lug_height, 2);
            }

            translate([0, 0, floor_thickness])
                rounded_prism(
                    inner_length,
                    inner_width,
                    base_height + 1,
                    max(1, corner_radius - wall)
                );

            translate([
                shell_length / 2 - wall * 1.5,
                -usb_window_width / 2,
                usb_window_bottom
            ])
                cube([wall * 3, usb_window_width, usb_window_height]);

            translate([lug_center_x - 1, 0, -0.5])
                cylinder(h = lanyard_lug_height + 1, d = lanyard_hole_diameter);
        }

        translate([-rail_length / 2, rail_offset_y - 1.1, floor_thickness])
            cube([rail_length, 2.2, 2.2]);
        translate([-rail_length / 2, -rail_offset_y - 1.1, floor_thickness])
            cube([rail_length, 2.2, 2.2]);
    }
}

module trace_lid() {
    inner_length = shell_length - 2 * wall;
    inner_width = shell_width - 2 * wall;
    lip_outer_length = inner_length - 2 * fit_clearance;
    lip_outer_width = inner_width - 2 * fit_clearance;
    lip_inner_length = lip_outer_length - 2 * lid_lip_wall;
    lip_inner_width = lip_outer_width - 2 * lid_lip_wall;

    difference() {
        union() {
            difference() {
                rounded_prism(
                    lip_outer_length,
                    lip_outer_width,
                    lid_lip_height,
                    max(1, corner_radius - wall - fit_clearance)
                );
                translate([0, 0, -0.1])
                    rounded_prism(
                        lip_inner_length,
                        lip_inner_width,
                        lid_lip_height + 0.2,
                        max(1, corner_radius - wall - fit_clearance - lid_lip_wall)
                    );
            }

            translate([0, 0, lid_lip_height])
                rounded_prism(shell_length, shell_width, lid_top_thickness, corner_radius);

            translate([0, 0, lid_lip_height + lid_top_thickness])
                rounded_prism(
                    pressure_pad_length,
                    pressure_pad_width,
                    pressure_pad_height,
                    6
                );
        }

        translate([0, 0, lid_lip_height - 0.01])
            cylinder(h = fsr_pocket_depth + 0.02, d = fsr_pocket_diameter);

        translate([
            -2,
            0,
            lid_lip_height - 0.01
        ])
            cube([4, shell_width / 2, fsr_pocket_depth + 0.02]);
    }
}

if (part == 1) {
    trace_base();
} else if (part == 2) {
    trace_lid();
} else {
    color("gainsboro") trace_base();
    color("lightsteelblue")
        translate([0, 0, base_height + 2]) trace_lid();
}
