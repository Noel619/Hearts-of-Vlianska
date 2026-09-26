import type { EventDef } from '../../game/types';
import { GLOBAL_EVENTS } from './global';
import { FACTION_EVENTS } from '../focus';

export const EVENT_LIST: EventDef[] = [...GLOBAL_EVENTS, ...FACTION_EVENTS];
