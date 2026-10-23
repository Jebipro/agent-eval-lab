import type { ParseResult } from './parse';
export interface ParseRequest { readonly protocol: 1; readonly id: number; readonly file: Blob }
export interface ParseResponse { readonly protocol: 1; readonly id: number; readonly result: ParseResult }
