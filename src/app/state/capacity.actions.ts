import { createAction, props } from '@ngrx/store';
import { CapacityRow } from '../capacity-planner.component';

export const loadCapacity = createAction('[Capacity] Load');
export const loadCapacitySuccess = createAction('[Capacity] Load Success', props<{ rows: CapacityRow[] }>());
export const loadCapacityFailure = createAction('[Capacity] Load Failure', props<{ error: any }>());

export const saveCapacity = createAction('[Capacity] Save', props<{ rows: CapacityRow[] }>());
export const saveCapacitySuccess = createAction('[Capacity] Save Success');
export const saveCapacityFailure = createAction('[Capacity] Save Failure', props<{ error: any }>());

export const updateRow = createAction('[Capacity] Update Row', props<{ index: number, row: CapacityRow }>());
export const addRow = createAction('[Capacity] Add Row');
export const setSearch = createAction('[Capacity] Set Search', props<{ search: string }>());
