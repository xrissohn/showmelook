import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ pending: [] as Array<{start:number; resolve:(value:any)=>void}>, orders: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({supabase:{from:()=>{
  const query = {select:()=>query,order:(column:string)=>{state.orders.push(column);return query;},range:(start:number)=>new Promise(resolve=>state.pending.push({start,resolve}))};
  return query;
}}}));
import { useCommunityFeed } from './useCommunityFeed';
const rows = (start:number) => Array.from({length:20},(_,i)=>({id:String(start+i),image_url:`https://x/${start+i}.png`,gallery_user_key:'u'}));
beforeEach(()=>{state.pending=[];state.orders=[];});
describe('useCommunityFeed pagination',()=>{
 it('blocks concurrent append requests and deduplicates an overlapping page',async()=>{
  const {result}=renderHook(()=>useCommunityFeed());
  await act(async()=>state.pending[0].resolve({data:rows(0),error:null}));
  act(()=>{result.current.loadMore();result.current.loadMore();});
  expect(state.pending).toHaveLength(2);expect(state.pending[1].start).toBe(20);
  await act(async()=>state.pending[1].resolve({data:rows(19),error:null}));
  expect(result.current.looks).toHaveLength(39);
  expect(state.orders.slice(0,3)).toEqual(['like_count','created_at','id']);
 });
 it('ignores old responses after sort changes',async()=>{
  const {result}=renderHook(()=>useCommunityFeed());
  act(()=>result.current.setSortBy('latest'));
  await waitFor(()=>expect(state.pending).toHaveLength(2));
  await act(async()=>state.pending[1].resolve({data:rows(100),error:null}));
  await act(async()=>state.pending[0].resolve({data:rows(0),error:null}));
  expect(result.current.looks[0].id).toBe('100');
 });
 it('releases the request lock on failure without skipping the failed page',async()=>{
  const {result}=renderHook(()=>useCommunityFeed());
  await act(async()=>state.pending[0].resolve({data:rows(0),error:null}));
  act(()=>result.current.loadMore());
  await act(async()=>state.pending[1].resolve({data:null,error:{message:'temporary'}}));
  act(()=>result.current.loadMore());
  expect(state.pending[2].start).toBe(20);
  await act(async()=>state.pending[2].resolve({data:rows(20),error:null}));
  expect(result.current.looks).toHaveLength(40);
 });
});
