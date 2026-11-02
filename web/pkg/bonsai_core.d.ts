/* tslint:disable */
/* eslint-disable */

export class BonsaiWasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 推进一个季节，返回包含四季更迭报表的 JSON 字符串
     */
    advance_season(): string;
    /**
     * 对指定枝段缠绕铝丝并设定弯曲目标方向
     */
    apply_wire(segment_id: number, gauge_mm: number, target_dir_x: number, target_dir_y: number, target_dir_z: number): boolean;
    /**
     * 评估 Wiki 规则并返回教练诊断警告列表
     */
    evaluate_rules(recent_loss_ratio: number): string;
    /**
     * 获取最近一次修剪造成的生物质损失比例
     */
    get_last_loss_ratio(): number;
    /**
     * 打包全部节间数据供前端 Three.js 直读：
     * 每个枝段布局 [id, order, radius, startX, startY, startZ, endX, endY, endZ] (共 9 个 f32)
     */
    get_segments_buffer(): Float32Array;
    /**
     * 获取树木核心状态（季节、树龄、能量池、枝段数量）
     */
    get_tree_info(): string;
    constructor(seed: number);
    /**
     * 执行剪枝，切除指定枝条并激活潜伏芽
     */
    prune_branch(segment_id: number): boolean;
    /**
     * 拆除指定枝段上的铝丝
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
