export interface CapacityRow {
  month: string;
  rtb: number;
  forecastedCapacity: number;
  capacityRequested: number;
  remainingCapacity: number;
  deferredNew: number;
}

import { Subscription } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as CapacityActions from './state/capacity.actions';
import * as CapacitySelectors from './state/capacity.selectors';

@Component({
  selector: 'app-capacity-planner',
  templateUrl: './capacity-planner.component.html',
  styleUrls: ['./capacity-planner.component.scss'],
})
export class CapacityPlannerComponent implements OnInit {
  // ...existing properties and methods...

  // Returns the sum of all extra CTB row values for a given month index
  getCtbSumByMonth(monthIdx: number): number {
    if (!this.extraCtbRows || this.extraCtbRows.length === 0) {
      return 0;
    }
    // Sum the value at monthIdx for each extra CTB row
    return this.extraCtbRows.reduce((sum: number, row: any) => sum + (Number(row.values[monthIdx]) || 0), 0);
  }
  statusOptions: { label: string; value: string }[] = [
    { label: 'New', value: 'New' },
    { label: 'Priority', value: 'Priority' },
    { label: 'Deferred', value: 'Deferred' }
  ];
  selectedStatus: string | null = null;
  // --- Extra CTB rows logic ---
  extraCtbRows: Array<{ id: number; values: number[]; total: number; status?: string }> = [];
  private ctbRowIdCounter = 1;

  addExtraCtbRow() {
    const months = this.rowsLocal.length;
    this.extraCtbRows.push({
      id: this.ctbRowIdCounter++,
      values: Array(months).fill(0),
      total: 0,
      status: undefined
    });
  }

  deleteExtraCtbRow(id: number) {
    this.extraCtbRows = this.extraCtbRows.filter((row) => row.id !== id);
  }

  // Update total for each extra CTB row when values change
  ngDoCheck() {
    for (const extra of this.extraCtbRows) {
      extra.total = extra.values.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
    }
  }
  // --- Extra CTB rows logic ---
  onRtbInput(index: number, input: HTMLInputElement) {
    const row = this.rowsLocal[index];
    let val = Number(input.value);
    let max = row.forecastedCapacity - row.capacityRequested;
    if (isNaN(val) || val < 0) val = 0;
    if (val > max) {
      val = max < 0 ? 0 : max;
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'RTB + CTB cannot exceed Forecasted Capacity. Value adjusted.',
      });
    }
    row.rtb = val;
    row.remainingCapacity =
      row.forecastedCapacity - row.rtb - row.capacityRequested;
    input.value = String(row.rtb);
  }

  onCtbInput(index: number, input: HTMLInputElement) {
    const row = this.rowsLocal[index];
    let val = Number(input.value);
    let max = row.forecastedCapacity - row.rtb;
    if (isNaN(val) || val < 0) val = 0;
    if (val > max) {
      val = max < 0 ? 0 : max;
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'RTB + CTB cannot exceed Forecasted Capacity. Value adjusted.',
      });
    }
    row.capacityRequested = val;
    row.remainingCapacity =
      row.forecastedCapacity - row.rtb - row.capacityRequested;
    input.value = String(row.capacityRequested);
  }
  validateRtbCtb(index: number, field: 'rtb' | 'ctb') {
    const row = this.rowsLocal[index];
    // Clamp RTB and CTB to not allow sum > forecastedCapacity
    let changed = false;
    if (field === 'rtb') {
      let maxRtb = row.forecastedCapacity - row.capacityRequested;
      if (maxRtb < 0) maxRtb = 0;
      if (row.rtb > maxRtb) {
        row.rtb = maxRtb;
        changed = true;
      }
      if (row.rtb < 0 || isNaN(row.rtb)) {
        row.rtb = 0;
        changed = true;
      }
    } else {
      let maxCtb = row.forecastedCapacity - row.rtb;
      if (maxCtb < 0) maxCtb = 0;
      if (row.capacityRequested > maxCtb) {
        row.capacityRequested = maxCtb;
        changed = true;
      }
      if (row.capacityRequested < 0 || isNaN(row.capacityRequested)) {
        row.capacityRequested = 0;
        changed = true;
      }
    }
    row.remainingCapacity =
      row.forecastedCapacity - row.rtb - row.capacityRequested;
    if (changed) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'RTB + CTB cannot exceed Forecasted Capacity. Value adjusted.',
      });
    }
  }
  lastValidRtb: Array<number> = [];
  lastValidCapacityRequested: Array<number> = [];
  rowsLocal: CapacityRow[] = [];

  private rowsSub?: Subscription;
  onRtbBlur(index: number, row: CapacityRow) {
    this.updateRow(index, row);
  }

  onCapacityRequestedBlur(index: number, row: CapacityRow) {
    this.updateRow(index, row);
  }

  onDeferredNewBlur(index: number, row: CapacityRow) {
    this.updateRow(index, row);
  }
  search$: Observable<string>;
  rows$: Observable<CapacityRow[]>;
  loading$: Observable<boolean>;

  constructor(private store: Store, private messageService: MessageService) {
    this.search$ = this.store.select(CapacitySelectors.selectSearch);
    this.rows$ = this.store.select(CapacitySelectors.selectRows);
    this.loading$ = this.store.select(CapacitySelectors.selectLoading);
  }

  // --- Total calculation getters for template ---
  get totalForecastedCapacity(): number {
    return this.rowsLocal.reduce((a, b) => a + b.forecastedCapacity, 0);
  }
  get totalRtb(): number {
    return this.rowsLocal.reduce((a, b) => a + b.rtb, 0);
  }
  get totalCapacityRequested(): number {
    return this.rowsLocal.reduce((a, b) => a + b.capacityRequested, 0);
  }
  get totalRemainingCapacity(): number {
    return this.rowsLocal.reduce((a, b) => a + b.remainingCapacity, 0);
  }
  get totalDeferredNew(): number {
    return this.rowsLocal.reduce((a, b) => a + b.deferredNew, 0);
  }

  ngOnInit() {
    this.store.dispatch(CapacityActions.loadCapacity());
    this.rowsSub = this.rows$.subscribe((rows) => {
      // Deep clone to avoid mutating store state
      this.rowsLocal = rows.map((r) => ({ ...r }));
      // Initialize last valid values
      this.lastValidRtb = rows.map((r) => r.rtb);
      this.lastValidCapacityRequested = rows.map((r) => r.capacityRequested);
    });
  }

  addCapacityRow() {
    this.store.dispatch(CapacityActions.addRow());
  }

  getTotal(key: keyof CapacityRow): number {
    return this.rowsLocal.reduce(
      (sum, row) => sum + (Number(row[key]) || 0),
      0
    );
  }

  onLocalEdit(index: number) {
    const row = this.rowsLocal[index];
    // Validate RTB and Capacity Requested do not exceed remaining capacity
    const maxAllowed = row.forecastedCapacity;
    if (row.rtb + row.capacityRequested > maxAllowed) {
      // Determine which field was changed
      const rtbChanged = row.rtb !== this.lastValidRtb[index];
      const ctbChanged =
        row.capacityRequested !== this.lastValidCapacityRequested[index];
      if (rtbChanged) {
        row.rtb = maxAllowed - row.capacityRequested;
        this.lastValidRtb[index] = row.rtb;
        this.messageService.add({
          severity: 'warn',
          summary: 'Validation',
          detail:
            'RTB + CTB cannot exceed Forecasted Capacity. Value adjusted.',
        });
      } else if (ctbChanged) {
        row.capacityRequested = maxAllowed - row.rtb;
        this.lastValidCapacityRequested[index] = row.capacityRequested;
        this.messageService.add({
          severity: 'warn',
          summary: 'Validation',
          detail:
            'RTB + CTB cannot exceed Forecasted Capacity. Value adjusted.',
        });
      }
    } else {
      this.lastValidRtb[index] = row.rtb;
      this.lastValidCapacityRequested[index] = row.capacityRequested;
    }
    row.remainingCapacity =
      row.forecastedCapacity - row.rtb - row.capacityRequested;
  }

  saveRows() {
    // Save all rows to the store
    this.store.dispatch(CapacityActions.saveCapacity({ rows: this.rowsLocal }));
  }

  ngOnDestroy() {
    if (this.rowsSub) this.rowsSub.unsubscribe();
  }

  updateRow(index: number, row: CapacityRow) {
    const updatedRow: CapacityRow = {
      ...row,
      remainingCapacity:
        row.forecastedCapacity - row.rtb - row.capacityRequested,
    };
    this.store.dispatch(CapacityActions.updateRow({ index, row: updatedRow }));
  }

  onSave(rows: CapacityRow[]) {
    this.store.dispatch(CapacityActions.saveCapacity({ rows }));
  }

  setSearch(search: string) {
    this.store.dispatch(CapacityActions.setSearch({ search }));
  }

  // When a value in an extra CTB row is increased, add 1 to the right cell
  onExtraCtbInput(rowIdx: number, colIdx: number, event: any) {
    const value = Number(event.target.value);
    if (isNaN(value) || value < 0) { return; }
    const row = this.extraCtbRows[rowIdx];
    // Only act if the value was increased
    if (value > (row.values[colIdx] ?? 0)) {
      if (colIdx + 1 < row.values.length) {
        row.values[colIdx + 1] = Number(row.values[colIdx + 1] || 0) + 1;
      }
    }
    row.values[colIdx] = value;
    // Update total for this row
    row.total = row.values.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
  }
}
