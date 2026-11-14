import type { EventDef } from '../../game/types';
import { GLOBAL_EVENTS } from './global';
import { FACTION_EVENTS } from '../focus';
import { STORY_EVENTS } from './story';

export const EVENT_LIST: EventDef[] = [...GLOBAL_EVENTS, ...STORY_EVENTS, ...FACTION_EVENTS];
export { STORY_SPIRITS } from './story';
