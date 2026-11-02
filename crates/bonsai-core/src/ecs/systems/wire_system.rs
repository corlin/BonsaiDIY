use crate::ecs::world::BonsaiWorld;
use crate::ecs::components::WireFixture;

/// 金属丝盘扎与塑性形变系统 (WireSystem)
pub fn run_apply_wire_system(
    world: &mut BonsaiWorld,
    segment_id: u32,
    gauge_mm: f32,
    target_bend: [f32; 3],
) -> Result<(), String> {
    let target = world.geometries.keys().find(|e| e.id == segment_id).copied();
    let Some(ent) = target else {
        return Err(format!("Segment ID {} not found", segment_id));
    };

    let geom = world.geometries.get(&ent).cloned().unwrap();
    // 铝丝力学刚度校验：线径至少需达到枝条直径的 1/3 (0.33)
    let branch_dia_mm = geom.radius * 2.0 * 1000.0;
    if gauge_mm < branch_dia_mm * 0.33 {
        return Err(format!(
            "Wire gauge {:.1}mm is too thin for branch diameter {:.1}mm (requires >= 1/3 ratio)",
            gauge_mm, branch_dia_mm
        ));
    }

    let initial_dir = geom.direction();
    let len = geom.length();

    // 弯曲枝条末端几何位置
    if let Some(g) = world.geometries.get_mut(&ent) {
        g.end = [
            g.start[0] + target_bend[0] * len,
            g.start[1] + target_bend[1] * len,
            g.start[2] + target_bend[2] * len,
        ];
    }

    let wire = WireFixture {
        gauge_mm,
        initial_dir,
        target_bend,
        season_counter: 0,
        has_bitten: false,
    };
    world.wires.insert(ent, wire);

    Ok(())
}

pub fn run_remove_wire_system(world: &mut BonsaiWorld, segment_id: u32) -> Result<bool, String> {
    let target = world.wires.keys().find(|e| e.id == segment_id).copied();
    let Some(ent) = target else {
        return Err(format!("No wire found on segment ID {}", segment_id));
    };

    let wire = world.wires.remove(&ent).unwrap();
    let is_permanently_set = wire.season_counter >= 2;

    // 若未满 2 季，发生弹性回弹 (Springback)
    if !is_permanently_set {
        if let Some(g) = world.geometries.get_mut(&ent) {
            let len = g.length();
            g.end = [
                g.start[0] + wire.initial_dir[0] * len,
                g.start[1] + wire.initial_dir[1] * len,
                g.start[2] + wire.initial_dir[2] * len,
            ];
        }
    }

    Ok(is_permanently_set)
}
