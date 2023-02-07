import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface _SERVICE {
  'public_key' : ActorMethod<
    [],
    { 'Ok' : { 'public_key' : Uint8Array | number[] } } |
      { 'Err' : string }
  >,
  'public_key_query' : ActorMethod<
    [],
    { 'Ok' : { 'public_key' : Uint8Array | number[] } } |
      { 'Err' : string }
  >,
  'sign' : ActorMethod<
    [Uint8Array | number[]],
    { 'Ok' : { 'signature' : Uint8Array | number[] } } |
      { 'Err' : string }
  >,
}
