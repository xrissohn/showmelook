/* eslint-disable */
// @ts-nocheck
import { makeClient } from "./fake_supabase.ts";
export function createClient(_url: string, _key: string) { return makeClient((globalThis as any).__DB); }
