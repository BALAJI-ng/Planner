import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
// New interfaces for API response
export interface ForecastColumn {
  id: number;
  month: number | null;
  year: number | null;
  amount: number | null;
  columnLabel: string | null;
  rowLabel: string | null;
  cellCss: string;
  // ...other fields as needed
}

export interface ForecastRow {
  forecastColumns: ForecastColumn[];
}

export interface CapacityForecastResponse {
  result: {
    transformationUnitId: number;
    forecastRows: ForecastRow[];
  };
}

import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-capacity-planner',
  templateUrl: './capacity-planner.component.html',
  styleUrls: ['./capacity-planner.component.scss'],
})
export class CapacityPlannerComponent implements OnInit {
  exportToExcel() {
    // Prepare header
    const header = ['Row Label', 'Total'];
    // Helper to format month-year as 'Feb-2025'
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
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
    // Prepare data rows
    const dataRows = this.forecastRows.map((row) => {
      const rowArr: any[] = [];
      rowArr.push(row.forecastColumns[0].rowLabel);
      // Total column
      if (row.forecastColumns[0].rowLabel === 'Remaining Capacity') {
        rowArr.push(this.getRowTotal(row));
      } else if (this.isTotalDynamic(row.forecastColumns[0].rowLabel)) {
        rowArr.push(this.getRowTotal(row));
      } else {
        rowArr.push(row.forecastColumns[1]?.amount != null ? row.forecastColumns[1].amount : 0);
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

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Capacity Plan');
    worksheet.addRow(header);
    dataRows.forEach((row) => worksheet.addRow(row));

    // Add black border to all cells
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
      .get<any>('assets/capacity_forecast_24_months.json')
      .subscribe((data) => {
        // If your API returns an array, adjust accordingly
        // If it returns an object with result.forecastRows, adjust as below
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
