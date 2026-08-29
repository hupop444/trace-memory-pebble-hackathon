/* TRACE wearable pebble enclosure — parametric FDM source

   CLI examples:
   openscad.com -o bag_back.stl -D 'variant="bag_esp32"' -D 'part="back"' TRACE_pebble_parametric.scad
   openscad.com -o badge_front.stl -D 'variant="badge_mini"' -D 'part="front"' TRACE_pebble_parametric.scad

   All dimensions are millimetres. Measure the physical PCB before the final print.
*/

$fn = 56;
variant = is_undef(variant) ? "bag_esp32" : variant;
part = is_undef(part) ? "assembly" : part;
/* The reference-locked style is the production default.  Set this to
   "legacy_trace" only when reproducing the earlier groove/dimple concept. */
visual_style = is_undef(visual_style) ? "reference_locked" : visual_style;

H = variant == "bag_esp32" ? 86 : variant == "badge_mini" ? 74 : 70;
W = variant == "bag_esp32" ? 66 : 46;
D = variant == "bag_esp32" ? 34 : 21;
wall = variant == "bag_esp32" ? 2.2 : 2.0;

board_l = variant == "bag_esp32" ? 62.4 : 36;
board_w = variant == "bag_esp32" ? 28 : 26;
board_h = variant == "bag_esp32" ? 10 : 6;
board_y = variant == "bag_esp32" ? 0 : variant == "badge_mini" ? -6 : -5;
board_clearance = 0.45;

usb_w = variant == "bag_esp32" ? 13.2 : 11.8;
usb_h = variant == "bag_esp32" ? 8.2 : 7.0;
usb_z = variant == "bag_esp32" ? -0.8 : -0.3;

dent_x = variant == "bag_esp32" ? 6 : 4;
dent_y = variant == "bag_esp32" ? -5 : variant == "badge_mini" ? -5 : -4;
dent_d = variant == "bag_esp32" ? 29 : 23;
dent_depth = variant == "bag_esp32" ? 0.75 : 0.65;
sensor_d = variant == "bag_esp32" ? 14 : 12;

tongue_clearance = 0.28;
tongue_t = 0.90;


module organic_pebble(inset=0) {
    w = W - 2*inset;
    h = H - 2*inset;
    d = D - 2*inset;
    /* Three restrained fields produce a non-generic asymmetric stone while
       retaining a continuous, pocket-safe silhouette. */
    hull() {
        translate([-0.018*w, 0.022*h, 0])
            scale([0.475*w, 0.470*h, 0.490*d]) sphere(1);
        translate([0.034*w, -0.052*h, -0.008*d])
            scale([0.455*w, 0.440*h, 0.472*d]) sphere(1);
        translate([-0.042*w, 0.112*h, 0.010*d])
            scale([0.425*w, 0.372*h, 0.455*d]) sphere(1);
    }
}

function ellipsoid_front_z(x,y,cx,cy,cz,rx,ry,rz) =
    let(q=1-pow((x-cx)/rx,2)-pow((y-cy)/ry,2))
    q > 0 ? cz+rz*sqrt(q) : -1000;

/* Surface estimator follows the same three ellipsoids used by organic_pebble.
   The small positive allowance accounts for the convex hull between fields. */
function front_surface_z(x,y) = 0.25 + max(
    ellipsoid_front_z(x,y,-0.018*W,0.022*H,0,0.475*W,0.470*H,0.490*D),
    ellipsoid_front_z(x,y,0.034*W,-0.052*H,-0.008*D,0.455*W,0.440*H,0.472*D),
    ellipsoid_front_z(x,y,-0.042*W,0.112*H,0.010*D,0.425*W,0.372*H,0.455*D)
);

module shell() {
    difference() {
        organic_pebble(0);
        organic_pebble(wall);
    }
}

module ellipse_ring(rx, ry, t, z0, hh) {
    translate([0,0,z0])
        linear_extrude(height=hh)
            difference() {
                scale([rx,ry]) circle(1);
                scale([rx-t,ry-t]) circle(1);
            }
}

module back_half_shell() {
    intersection() {
        shell();
        translate([-W, -H, -D]) cube([2*W,2*H,D]);
    }
}

module front_half_shell() {
    intersection() {
        shell();
        translate([-W, -H, 0]) cube([2*W,2*H,D]);
    }
}

module tongue() {
    ellipse_ring(W/2-wall*1.10,H/2-wall*1.10,tongue_t,-0.05,2.8);
}

module tongue_groove() {
    ellipse_ring(
        W/2-wall*1.10+tongue_clearance,
        H/2-wall*1.10+tongue_clearance,
        tongue_t+2*tongue_clearance,
        -0.12,
        3.15
    );
}

module joint_collar(z0,hh) {
    collar_t=wall*0.45+tongue_t+tongue_clearance+0.65;
    ellipse_ring(W/2-wall*0.65,H/2-wall*0.65,collar_t,z0,hh);
}

module usb_cut() {
    translate([-usb_w/2,-H/2-7,usb_z-usb_h/2]) cube([usb_w,16,usb_h]);
}

module board_cradle() {
    c = board_clearance;
    tray_w = board_w + 2*c + 3;
    tray_l = board_l + 2*c + 3;
    tray_z = D > 25 ? -4.8 : -3.8;
    tray_t = 1.25;
    rail_h = 2.5;
    rail_t = 1.25;
    side_l = board_l + 2*c;
    stop_w = board_w + 2*c + 2*rail_t;

    translate([-tray_w/2,board_y-tray_l/2,tray_z]) cube([tray_w,tray_l,tray_t]);

    /* Outer-clipped support posts join the curved rear skin without witness
       marks or external protrusions. */
    intersection() {
        organic_pebble(0);
        union() {
            for (x=[-board_w/2-c-0.8,board_w/2+c+0.8])
                for (y=[board_y-board_l/2-c-0.8,board_y+board_l/2+c+0.8])
                    translate([x,y,-D/2]) cylinder(r=2.1,h=D/2+tray_z+tray_t);
        }
    }

    translate([-board_w/2-c-rail_t,board_y-side_l/2,tray_z+tray_t])
        cube([rail_t,side_l,rail_h]);
    translate([board_w/2+c,board_y-side_l/2,tray_z+tray_t])
        cube([rail_t,side_l,rail_h]);
    translate([-stop_w/2,board_y+board_l/2+c,tray_z+tray_t])
        cube([stop_w,rail_t,rail_h]);
    for (x=[-stop_w/2,stop_w/2-5])
        translate([x,board_y-board_l/2-c-rail_t,tray_z+tray_t])
            cube([5,rail_t,rail_h]);
}

module attachment_loop(outer_r,inner_r,z0,thick) {
    cy = H/2 + outer_r*0.25;
    translate([0,cy,z0])
        difference() {
            cylinder(r=outer_r,h=thick);
            translate([0,0,-0.1]) cylinder(r=inner_r,h=thick+0.2);
        }
    translate([-outer_r,H/2-6,z0]) cube([2*outer_r,outer_r*1.55,thick]);
}

module garment_bridge() {
    z_base = -D/2-0.2;
    rail_w=24; rail_h=5; rail_t=1.8; gap=2.2;
    for (y=[-11,7]) {
        translate([-rail_w/2,y,z_base]) cube([4,rail_h,gap+rail_t]);
        translate([rail_w/2-4,y,z_base]) cube([4,rail_h,gap+rail_t]);
        translate([-rail_w/2,y,z_base-rail_t]) cube([rail_w,rail_h,rail_t]);
    }
}

/* Rear-only bridge keeps all functional attachment geometry inside the front
   silhouette.  The slot accepts a flat silicone tether or a badge webbing
   adapter while the product face remains an uninterrupted pebble. */
module hidden_rear_bridge(bridge_w, bridge_y, slot_h, bridge_t) {
    z_base = -D/2-0.15;
    foot_w = 4.2;
    foot_h = slot_h + 2.8;

    translate([-bridge_w/2,bridge_y-foot_h/2,z_base])
        cube([foot_w,foot_h,slot_h+bridge_t]);
    translate([bridge_w/2-foot_w,bridge_y-foot_h/2,z_base])
        cube([foot_w,foot_h,slot_h+bridge_t]);
    translate([-bridge_w/2,bridge_y-foot_h/2,z_base-bridge_t])
        cube([bridge_w,foot_h,bridge_t]);
}

module thumb_dent_cutter() {
    r = dent_d/2;
    translate([dent_x,dent_y,front_surface_z(dent_x,dent_y)+r-dent_depth]) sphere(r);
}

module crease_node(t) {
    start_x = -W*0.19;
    start_y = H*0.23;
    end_x = dent_x-dent_d*0.18;
    end_y = dent_y+dent_d*0.20;
    gr = W > 50 ? 0.85 : 0.68;
    x=start_x*(1-t)+end_x*t+sin(t*180)*W*0.018;
    y=start_y*(1-t)+end_y*t;
    nx=x/(W*0.49);
    ny=y/(H*0.49);
    zsurf=front_surface_z(x,y);
    translate([x,y,zsurf-0.55]) cylinder(r=gr,h=D);
}

module trace_crease_cutter() {
    union() {
        for (i=[0:5]) hull() {
            crease_node(i/6);
            crease_node((i+1)/6);
        }
    }
}

module pressure_sensor_seat() {
    nx=dent_x/(W*0.49);
    ny=dent_y/(H*0.49);
    inner_half=(D-2*wall)/2;
    zinner=inner_half*sqrt(max(0.10,1-nx*nx-ny*ny));
    seat_h=1.35;
    orad=sensor_d/2+1.15;
    irad=sensor_d/2+0.25;
    translate([dent_x,dent_y,zinner-seat_h])
        difference() {
            cylinder(r=orad,h=seat_h);
            translate([0,0,-0.1]) cylinder(r=irad,h=seat_h+0.2);
        }
}

module back_part() {
    difference() {
        union() {
            back_half_shell();
            joint_collar(-0.72,0.82);
            tongue();
            board_cradle();
            if (visual_style=="reference_locked") {
                if (variant=="bag_esp32") hidden_rear_bridge(24,H*0.24,3.2,2.0);
                if (variant=="badge_mini") hidden_rear_bridge(18,H*0.24,2.4,1.8);
                if (variant=="clip_mini") garment_bridge();
            } else {
                if (variant=="bag_esp32") attachment_loop(5.6,2.7,-3.8,3.8);
                if (variant=="badge_mini") attachment_loop(4.4,2.0,-3.2,3.2);
                if (variant=="clip_mini") garment_bridge();
            }
        }
        usb_cut();
    }
}

module front_part() {
    difference() {
        union() {
            front_half_shell();
            joint_collar(0,3.15);
        }
        tongue_groove();
        if (visual_style=="legacy_trace") {
            thumb_dent_cutter();
            trace_crease_cutter();
        }
    }
}

module board_keepout() {
    tray_z=D>25 ? -4.8 : -3.8;
    translate([-board_w/2,board_y-board_l/2,tray_z+1.25])
        cube([board_w,board_l,board_h]);
}

if (part=="back") back_part();
if (part=="front") front_part();
if (part=="front_raw") front_half_shell();
if (part=="board") board_keepout();
if (part=="sensor") pressure_sensor_seat();
if (part=="assembly") {
    color([0.87,0.89,0.88,0.42]) back_part();
    color([0.93,0.92,0.89,0.48]) front_part();
    color([0.05,0.34,0.23,0.85]) board_keepout();
    color([0.12,0.12,0.12,1]) pressure_sensor_seat();
}
