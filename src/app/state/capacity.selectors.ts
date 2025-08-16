import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CapacityState } from './capacity.reducer';

export const selectCapacityState = createFeatureSelector<CapacityState>('capacity');

export const selectRows = createSelector(
  selectCapacityState,
  state => state.rows
);

export const selectSearch = createSelector(
  selectCapacityState,
  state => state.search
);

export const selectLoading = createSelector(
  selectCapacityState,
  state => state.loading
);

export const selectError = createSelector(
  selectCapacityState,
  state => state.error
);
