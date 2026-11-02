/* tslint:disable */
/* eslint-disable */

/**
 * WASM 跨语言桥接引擎 (BonsaiWasmEngine)
 * 彻底基于纯净 ECS 架构 (BonsaiWorld + BonsaiScheduler)
 * 严格解耦物理仿真与图形渲染，支持多通道零拷贝缓冲区提取
 */
export class BonsaiWasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 推进生长季 (通过 BonsaiCommand 执行春抽梢/夏加粗/秋回流/冬休眠)
     */
    advance_season(): string;
    /**
     * 缠绕金属丝塑性定型
     */
    apply_wire(segment_id: number, gauge_mm: number, dx: number, dy: number, dz: number): boolean;
    /**
     * 运行 Wiki 造型与比例美学规则审计系统
     */
    evaluate_rules(recent_loss: number): string;
    /**
     * 统一通用命令执行入口 (支持 JSON 格式指令输入与确定性回放)
     */
    execute_command(command_json: string): string;
    /**
     * 抽取潜伏芽位通道 (6-Float 步长)
     * [parent_id, pos_x, pos_y, pos_z, dir_x, state]
     */
    get_buds_buffer(): Float32Array;
    /**
     * 抽取梢头叶托通道 (8-Float 步长，供 GPU InstancedMesh 批量实例化)
     * [parent_id, center_x, center_y, center_z, normal_x, normal_y, normal_z, leaf_count]
     */
    get_foliage_buffer(): Float32Array;
    /**
     * 获取最近一次修剪造成的生物质损失比例
     */
    get_last_loss_ratio(): number;
    /**
     * 抽取枝干几何通道 (9-Float 步长，直接映射 Float32Array 零拷贝切片)
     * [id, order, radius, start_x, start_y, start_z, end_x, end_y, end_z]
     */
    get_segments_buffer(): Float32Array;
    /**
     * 获取整树概况元数据
     */
    get_tree_info(): string;
    constructor(seed: number);
    /**
     * 修剪指定枝段 (通过 BonsaiCommand 执行原子剪枝与潜伏芽激活)
     */
    prune_branch(segment_id: number): boolean;
    /**
     * 拆除金属丝
     */
    remove_wire(segment_id: number): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_bonsaiwasmengine_free: (a: number, b: number) => void;
    readonly bonsaiwasmengine_advance_season: (a: number) => [number, number];
    readonly bonsaiwasmengine_apply_wire: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly bonsaiwasmengine_evaluate_rules: (a: number, b: number) => [number, number];
    readonly bonsaiwasmengine_execute_command: (a: number, b: number, c: number) => [number, number];
    readonly bonsaiwasmengine_get_buds_buffer: (a: number) => [number, number];
    readonly bonsaiwasmengine_get_foliage_buffer: (a: number) => [number, number];
    readonly bonsaiwasmengine_get_last_loss_ratio: (a: number) => number;
    readonly bonsaiwasmengine_get_segments_buffer: (a: number) => [number, number];
    readonly bonsaiwasmengine_get_tree_info: (a: number) => [number, number];
    readonly bonsaiwasmengine_new: (a: number) => number;
    readonly bonsaiwasmengine_prune_branch: (a: number, b: number) => number;
    readonly bonsaiwasmengine_remove_wire: (a: number, b: number) => number;
    readonly bonsai_create_engine: () => number;
    readonly bonsai_destroy_engine: (a: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
