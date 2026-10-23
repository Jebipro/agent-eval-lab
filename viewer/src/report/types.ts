// Type-only boundary: no CLI runtime modules are bundled into the Viewer.
export type { Report } from '../../../src/report/types';
import type { Report } from '../../../src/report/types';
export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type ReadonlyReport = DeepReadonly<Report>;
