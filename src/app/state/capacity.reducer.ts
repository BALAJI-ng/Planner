import { createReducer, on } from '@ngrx/store';
import * as CapacityActions from './capacity.actions';
import { CapacityRow } from '../capacity-planner.component';

export interface CapacityState {
  rows: CapacityRow[];
  search: string;
  loading: boolean;
  error: any;
}

const initialState: CapacityState = {
  rows: [],
  search: '',
  loading: false,
  error: null,
};

export const capacityReducer = createReducer(
  initialState,
  on(CapacityActions.loadCapacity, (state) => ({ ...state, loading: true })),
  on(CapacityActions.loadCapacitySuccess, (state, { rows }) => ({
    ...state,
    loading: false,
    rows,
  })),
  on(CapacityActions.loadCapacityFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(CapacityActions.saveCapacity, (state) => ({ ...state, loading: true })),
  on(CapacityActions.saveCapacitySuccess, (state) => ({
    ...state,
    loading: false,
  })),
  on(CapacityActions.saveCapacityFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(CapacityActions.updateRow, (state, { index, row }) => {
    const rows = state.rows.map((r, i) => (i === index ? { ...row } : r));
    return { ...state, rows };
  }),
  on(CapacityActions.addRow, (state) => ({
    ...state,
    rows: [
      ...state.rows,
      {
        month: '',
        rtb: 0,
        forecastedCapacity: 100,
        capacityRequested: 0,
        remainingCapacity: 100,
        deferredNew: 0,
      },
    ],
  })),
  on(CapacityActions.setSearch, (state, { search }) => ({ ...state, search }))
);
