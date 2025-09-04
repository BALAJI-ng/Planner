// ...existing imports and interfaces...

import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ForecastColumn {
  id: number;
  month: number | null;
  year: number | null;
  amount: number | null;
  columnLabel: string | null;
  rowLabel: string | null;
  cellCss: string;
}

export interface ForecastRow {
  forecastColumns: ForecastColumn[];
}

@Component({
  selector: 'app-capacity-planner',
  templateUrl: './capacity-planner.component.html',
  styleUrls: ['./capacity-planner.component.scss'],
})
export class CapacityPlannerComponent implements OnInit, AfterViewInit {
  getCTBMaxAllowed(ctbIdx: number, colIdx: number): number {
    const forecastedRow = this.forecastRows.find((r: any) =>
      r.forecastColumns[0].rowLabel?.includes('Forecasted')
    );
    const rtbRow = this.forecastRows.find(
      (r: any) => r.forecastColumns[0].rowLabel === 'RTB'
    );
    if (
      forecastedRow &&
      rtbRow &&
      forecastedRow.forecastColumns[colIdx + 1] &&
      rtbRow.forecastColumns[colIdx + 1]
    ) {
      const maxValue =
        (forecastedRow.forecastColumns[colIdx + 1].amount || 0) -
        (rtbRow.forecastColumns[colIdx + 1].amount || 0);
      let sumOtherRows = 0;
      for (let i = 0; i < this.ctbRows.length; i++) {
        if (i !== ctbIdx) {
          sumOtherRows += this.ctbRows[i].columns[colIdx].amount || 0;
        }
      }
      return Math.max(0, maxValue - sumOtherRows);
    }
    return 0;
  }
  getForecastedCapacityTotal(row: ForecastRow): number {
    // Slices from index 2 to skip label and total columns
    return row.forecastColumns
      .slice(2)
      .reduce((sum, col) => sum + (col.amount || 0), 0);
  }
  ctbSearchText: string = '';
  // Add ViewChild for both scroll containers
  @ViewChild('mainTableScroll', { static: false }) mainTableScroll: any;
  @ViewChild('ctbTableScroll', { static: false }) ctbTableScroll: any;

  // Scroll synchronization for tables
  ngAfterViewInit() {
    // Wait for PrimeNG tables to render their scroll containers
    setTimeout(() => {
      const scrollBodies = document.querySelectorAll(
        '.p-table-scrollable-body'
      );
      if (scrollBodies.length === 2) {
        const mainScrollable = scrollBodies[0];
        const ctbScrollable = scrollBodies[1];
        let isSyncing = false;
        mainScrollable.addEventListener('scroll', () => {
          if (isSyncing) return;
          isSyncing = true;
          ctbScrollable.scrollLeft = mainScrollable.scrollLeft;
          setTimeout(() => {
            isSyncing = false;
          }, 0);
        });
        ctbScrollable.addEventListener('scroll', () => {
          if (isSyncing) return;
          isSyncing = true;
          mainScrollable.scrollLeft = ctbScrollable.scrollLeft;
          setTimeout(() => {
            isSyncing = false;
          }, 0);
        });
      }
    }, 0);
  }
  // ...existing code...
  getCTBTotal(ctb: { columns: { amount: number | null }[] }): number {
    return ctb.columns.reduce((sum, col) => sum + (col.amount || 0), 0);
  }
  deleteCTBRow(idx: number) {
    this.ctbRows.splice(idx, 1);
    this.updateCTBRow();
  }

  addCTBComment(idx: number) {
    // Implement comment logic here, e.g., open a dialog or set a comment property
    this.messageService.add({
      severity: 'info',
      summary: 'Comment',
      detail: `Add comment for CTB row ${idx + 1}`,
      life: 2000,
    });
  }
  // Helper to get month/year for CTB columns (i matches columns in CTB table)
  getMonth(i: number): number | null {
    // columns[0] is Total, columns[1...] are months
    if (
      this.forecastRows.length > 0 &&
      this.forecastRows[0].forecastColumns[i]
    ) {
      return this.forecastRows[0].forecastColumns[i].month;
    }
    return null;
  }
  getYear(i: number): number | null {
    if (
      this.forecastRows.length > 0 &&
      this.forecastRows[0].forecastColumns[i]
    ) {
      return this.forecastRows[0].forecastColumns[i].year;
    }
    return null;
  }
  ctbStatusOptions = [
    { label: 'Deferred', value: 'Deferred' },
    { label: 'New', value: 'New' },
    { label: 'Canceled', value: 'Canceled' },
    { label: 'Prioritized', value: 'Prioritized' },
  ];
  ctbRows: Array<{
    name: string;
    columns: { amount: number | null }[];
    status?: string;
  }> = [];

  addCTBRow() {
    // Create columns for each month (skip label and total)
    const columns = this.columns.slice(1).map(() => ({ amount: 0 }));
    this.ctbRows.push({ name: '', columns, status: undefined });
    this.updateCTBRow();
  }

  // Removed stray code from previous patch attempts

  onCTBAmountChange(ctbIdx: number, colIdx: number, value: number) {
    // Restrict negative values
    let inputValue = value < 0 ? 0 : value;
    // Get Forecasted Capacity and RTB for this month
    const forecastedRow = this.forecastRows.find((r) =>
      r.forecastColumns[0].rowLabel?.includes('Forecasted')
    );
    const rtbRow = this.forecastRows.find(
      (r) => r.forecastColumns[0].rowLabel === 'RTB'
    );
    let newValue = inputValue;
    if (
      forecastedRow &&
      rtbRow &&
      forecastedRow.forecastColumns[colIdx + 1] &&
      rtbRow.forecastColumns[colIdx + 1]
    ) {
      const maxValue =
        (forecastedRow.forecastColumns[colIdx + 1].amount || 0) -
        (rtbRow.forecastColumns[colIdx + 1].amount || 0);
      // Calculate sum of all CTB rows for this month except the current row
      let sumOtherRows = 0;
      for (let i = 0; i < this.ctbRows.length; i++) {
        if (i !== ctbIdx) {
          sumOtherRows += this.ctbRows[i].columns[colIdx].amount || 0;
        }
      }
      // Calculate the max allowed for this input
      const maxAllowedForInput = Math.max(0, maxValue - sumOtherRows);
      if (inputValue > maxAllowedForInput) {
        newValue = 0;
        this.messageService.add({
          severity: 'warn',
          summary: 'Max Capacity',
          detail: 'Cannot exceed Remaining Capacity!',
          life: 2000,
        });
      }
    }
    this.ctbRows[ctbIdx].columns[colIdx].amount = newValue;
    this.updateCTBRow();
  }
  updateCTBRow() {
    // Find the CTB row in forecastRows
    const ctbRow = this.forecastRows.find(
      (r) => r.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)'
    );
    if (!ctbRow) return;
    // For each month column, sum all CTB rows and update the top table
    for (let i = 1; i < ctbRow.forecastColumns.length; i++) {
      let sum = 0;
      for (const ctb of this.ctbRows) {
        sum +=
          typeof ctb.columns[i - 1].amount === 'number'
            ? ctb.columns[i - 1].amount || 0
            : 0;
      }
      ctbRow.forecastColumns[i].amount = sum;
    }
  }
  exportToExcel() {
    // Prepare header for main table
    const header = ['Row Label', 'Total'];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    if (this.forecastRows.length > 0) {
      this.forecastRows[0].forecastColumns.slice(1).forEach((col) => {
        if (col.month != null && col.year != null) {
          const monthIdx = Number(col.month) - 1;
          const monthLabel = monthNames[monthIdx] || col.month;
          header.push(`${monthLabel}-${col.year}`);
        }
      });
    }
    // Prepare data rows for main table
    const dataRows = this.forecastRows.map((row) => {
      const rowArr: any[] = [];
      rowArr.push(row.forecastColumns[0].rowLabel);
      // Total column
      if (row.forecastColumns[0].rowLabel === 'Forecasted Capacity') {
        rowArr.push(this.getForecastedCapacityTotal(row));
      } else if (row.forecastColumns[0].rowLabel === 'Remaining Capacity') {
        rowArr.push(this.getRowTotal(row));
      } else if (this.isTotalDynamic(row.forecastColumns[0].rowLabel)) {
        rowArr.push(this.getRowTotal(row));
      } else {
        rowArr.push(
          row.forecastColumns[1]?.amount != null
            ? row.forecastColumns[1].amount
            : 0
        );
      }
      // Month columns
      row.forecastColumns.slice(1).forEach((col, idx) => {
        if (col.month == null || col.year == null) {
          return;
        }
        if (row.forecastColumns[0].rowLabel === 'Remaining Capacity') {
          rowArr.push(this.getRemainingCapacityAmount(idx + 1));
        } else {
          rowArr.push(col.amount != null ? col.amount : 0);
        }
      });
      return rowArr;
    });

    // Prepare CTB Details header
    const ctbHeader = ['CTB Name', 'Total'];
    if (this.forecastRows.length > 0) {
      this.forecastRows[0].forecastColumns.slice(1).forEach((col) => {
        if (col.month != null && col.year != null) {
          const monthIdx = Number(col.month) - 1;
          const monthLabel = monthNames[monthIdx] || col.month;
          ctbHeader.push(`${monthLabel}-${col.year}`);
        }
      });
    }
    // Prepare CTB Details data rows
    const ctbDataRows = this.ctbRows.map((ctb) => {
      const rowArr: any[] = [];
      rowArr.push(ctb.name || '');
      // Total
      rowArr.push(this.getCTBTotal(ctb));
      // Month columns (skip the first column, which is Total)
      for (let i = 1; i < ctb.columns.length; i++) {
        rowArr.push(ctb.columns[i].amount != null ? ctb.columns[i].amount : 0);
      }
      return rowArr;
    });

    // Create workbook and worksheets
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Capacity Plan');
    worksheet.addRow(header);
    dataRows.forEach((row) => worksheet.addRow(row));
    // Add a blank row between tables
    worksheet.addRow([]);
    // Add CTB Details header and data
    worksheet.addRow(ctbHeader);
    if (this.ctbRows.length > 0) {
      ctbDataRows.forEach((row) => worksheet.addRow(row));
    } else {
      worksheet.addRow(['No CTB records found']);
    }
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      saveAs(new Blob([buffer]), 'capacity_plan.xlsx');
    });
  }
  isInputDisabled(
    row: ForecastRow,
    col: ForecastColumn,
    monthIdx: number
  ): boolean {
    // Always allow decrease
    return false;
  }

  onAmountChange(
    row: ForecastRow,
    col: ForecastColumn,
    monthIdx: number,
    newValue: number
  ) {
    const max = this.getMaxAllowed(row, monthIdx);
    if (newValue < 0) {
      col.amount = null;
      return;
    }
    if (newValue > max) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Max Capacity',
        detail: 'Maximum capacity reached!',
        life: 2000,
      });
      col.amount = null;
      return;
    }
    // Prevent Capacity Requested by (CTB) from exceeding Remaining Capacity
    if (row.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)') {
      // Find Remaining Capacity row for the same column
      const remainingRow = this.forecastRows.find(
        (r) => r.forecastColumns[0].rowLabel === 'Remaining Capacity'
      );
      if (remainingRow && remainingRow.forecastColumns[monthIdx]) {
        const maxValue = remainingRow.forecastColumns[monthIdx].amount ?? 0;
        if (newValue > maxValue) {
          col.amount = maxValue;
          // Optionally show a message/toast here
          return;
        }
      }
    }
    col.amount = newValue;
  }

  isTotalDynamic(rowLabel: string | null): boolean {
    return (
      rowLabel === 'RTB' ||
      rowLabel === 'Capacity Requested by (CTB)' ||
      rowLabel === 'Remaining Capacity'
    );
  }

  getRowTotal(row: ForecastRow): number {
    const label = row.forecastColumns[0].rowLabel;
    if (label === 'Remaining Capacity') {
      // Find the corresponding rows
      const forecastedRow = this.forecastRows.find((r) =>
        r.forecastColumns[0].rowLabel?.includes('Forecasted')
      );
      const rtbRow = this.forecastRows.find(
        (r) => r.forecastColumns[0].rowLabel === 'RTB'
      );
      const ctbRow = this.forecastRows.find(
        (r) => r.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)'
      );
      let total = 0;
      if (forecastedRow && rtbRow && ctbRow) {
        for (let i = 2; i < row.forecastColumns.length; i++) {
          const forecasted = forecastedRow.forecastColumns[i]?.amount || 0;
          const rtb = rtbRow.forecastColumns[i]?.amount || 0;
          const ctb = ctbRow.forecastColumns[i]?.amount || 0;
          total += forecasted - rtb - ctb;
        }
      }
      return total;
    }
    // RTB and CTB: sum all editable columns (i > 1)
    return row.forecastColumns
      .slice(2)
      .reduce(
        (sum, col) => sum + (typeof col.amount === 'number' ? col.amount : 0),
        0
      );
  }

  getRemainingCapacityAmount(monthIdx: number): number {
    // monthIdx is the index in forecastColumns
    const forecastedRow = this.forecastRows.find((r) =>
      r.forecastColumns[0].rowLabel?.includes('Forecasted')
    );
    const rtbRow = this.forecastRows.find(
      (r) => r.forecastColumns[0].rowLabel === 'RTB'
    );
    const ctbRow = this.forecastRows.find(
      (r) => r.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)'
    );
    if (forecastedRow && rtbRow && ctbRow) {
      const forecasted = forecastedRow.forecastColumns[monthIdx]?.amount || 0;
      const rtb = rtbRow.forecastColumns[monthIdx]?.amount || 0;
      const ctb = ctbRow.forecastColumns[monthIdx]?.amount || 0;
      return forecasted - rtb - ctb;
    }
    return 0;
  }
  currentMonth: number = new Date().getMonth() + 1;
  currentYear: number = new Date().getFullYear();
  isEditable(
    rowLabel: string | null,
    month: number | null,
    year: number | null
  ): boolean {
    // Only RTB and CTB rows
    if (rowLabel !== 'RTB' && rowLabel !== 'Capacity Requested by (CTB)') {
      return false;
    }
    // Only editable for current or future months
    if (month == null || year == null) {
      return false;
    }
    if (year > this.currentYear) {
      return true;
    }
    if (year === this.currentYear && month >= this.currentMonth) {
      return true;
    }
    // Also allow editing for the current month and year
    if (year === this.currentYear && month === this.currentMonth) {
      return true;
    }
    return false;
  }
  forecastRows: ForecastRow[] = [];
  columns: string[] = [];

  constructor(
    private http: HttpClient,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.http
      .get<any>('http://localhost:3001/capacityTop')
      .subscribe((data) => {
        // JSON Server returns { result: { forecastRows: [...] } }
        const forecastRows =
          data.result?.forecastRows || data.forecastRows || data;
        this.forecastRows = forecastRows;
        if (
          this.forecastRows.length > 0 &&
          this.forecastRows[0] &&
          Array.isArray(this.forecastRows[0].forecastColumns)
        ) {
          this.columns = this.forecastRows[0].forecastColumns.map(
            (col: any) => col.columnLabel || col.rowLabel || ''
          );
        } else {
          this.columns = [];
        }
      });
  }

  // Example: Calculate total for a column index
  getTotalForColumn(colIdx: number): number {
    return this.forecastRows.reduce((sum: number, row: ForecastRow) => {
      const col = row.forecastColumns[colIdx];
      return sum + (col && typeof col.amount === 'number' ? col.amount : 0);
    }, 0);
  }

  // Add more calculation methods as needed, using forecastRows

  getMaxAllowed(row: ForecastRow, monthIdx: number): number {
    // Only applies to RTB and CTB rows
    const label = row.forecastColumns[0].rowLabel;
    if (label === 'RTB' || label === 'Capacity Requested by (CTB)') {
      const forecastedRow = this.forecastRows.find((r) =>
        r.forecastColumns[0].rowLabel?.includes('Forecasted')
      );
      const rtbRow = this.forecastRows.find(
        (r) => r.forecastColumns[0].rowLabel === 'RTB'
      );
      const ctbRow = this.forecastRows.find(
        (r) => r.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)'
      );
      if (forecastedRow && rtbRow && ctbRow) {
        const forecasted = forecastedRow.forecastColumns[monthIdx]?.amount || 0;
        const other =
          label === 'RTB'
            ? ctbRow.forecastColumns[monthIdx]?.amount || 0
            : rtbRow.forecastColumns[monthIdx]?.amount || 0;
        return forecasted - other;
      }
    }
    return 999999; // fallback for other rows
  }
}
