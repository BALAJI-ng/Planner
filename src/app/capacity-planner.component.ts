// ...existing imports and interfaces...

import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  ElementRef,
  HostListener,
} from '@angular/core';
import { Table } from 'primeng/table';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { CanComponentDeactivate } from './unsaved-changes.guard';

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
export class CapacityPlannerComponent implements OnInit, AfterViewInit, CanComponentDeactivate {
  // Reference to CTB table for paginator control
  @ViewChild('ctbTableRef') ctbTableRef?: Table;
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
      forecastedRow.forecastColumns[colIdx + 2] &&
      rtbRow.forecastColumns[colIdx + 2]
    ) {
      const maxValue =
        (forecastedRow.forecastColumns[colIdx + 2].amount || 0) -
        (rtbRow.forecastColumns[colIdx + 2].amount || 0);
      let sumOtherRows = 0;
      for (let i = 0; i < this.ctbRows.length; i++) {
        if (i !== ctbIdx && this.ctbRows[i].status === 'Prioritized') {
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
  @ViewChild('topTableScroll', { static: false }) topTableScroll?: ElementRef;
  @ViewChild('bottomTableScroll', { static: false })
  bottomTableScroll?: ElementRef;

  private isScrollSyncing = false;

  // Scroll synchronization methods
  onTopTableScroll(event: Event) {
    if (this.isScrollSyncing) return;

    this.isScrollSyncing = true;
    const target = event.target as HTMLElement;
    if (this.bottomTableScroll) {
      this.bottomTableScroll.nativeElement.scrollLeft = target.scrollLeft;
    }
    setTimeout(() => {
      this.isScrollSyncing = false;
    }, 0);
  }

  onBottomTableScroll(event: Event) {
    if (this.isScrollSyncing) return;

    this.isScrollSyncing = true;
    const target = event.target as HTMLElement;
    if (this.topTableScroll) {
      this.topTableScroll.nativeElement.scrollLeft = target.scrollLeft;
    }
    setTimeout(() => {
      this.isScrollSyncing = false;
    }, 0);
  }

  // Scroll synchronization for tables
  ngAfterViewInit() {
    // ViewChild elements will be available here if needed for any initialization
  }
  // ...existing code...
  getCTBTotal(ctb: any): number {
    // Calculate total by summing all month columns
    return ctb.columns && ctb.columns.length > 0
      ? ctb.columns.reduce(
          (total: number, col: any) => total + (col.amount || 0),
          0
        )
      : 0;
  }
  deleteCTBRow(idx: number) {
    this.ctbRows.splice(idx, 1);
    this.updateCTBRow();
    this.messageService.add({
      severity: 'success',
      summary: 'Record Deleted',
      detail: 'CTB record deleted successfully!',
      life: 3000,
    });
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

  // Get status options with disabled state for submitted records
  getStatusOptionsForCTB(ctb: any): any[] {
    // Return the base options array - we'll handle disabled state differently
    console.log('📋 getStatusOptionsForCTB called for:', {
      ctbName: ctb.name,
      currentStatus: ctb.status,
      statusType: typeof ctb.status,
      isNewRow: ctb.isNewRow,
      fullCTB: ctb
    });
    
    return this.ctbStatusOptions;
  }

  // Check if a specific option should be disabled for this CTB record
  isStatusOptionDisabled(ctb: any, optionValue: string): boolean {
    const isExistingRecord = !ctb.isNewRow;
    const shouldDisable = isExistingRecord && optionValue === 'New';
    
    console.log('🔒 Checking if option disabled:', {
      ctbName: ctb.name,
      optionValue: optionValue,
      isExistingRecord: isExistingRecord,
      shouldDisable: shouldDisable
    });
    
    return shouldDisable;
  }

  // Handle status change with validation
  onStatusChange(ctb: any, event: any): void {
    const selectedValue = event.value;
    const oldStatus = ctb.status;
    
    console.log('📝 Status change:', {
      ctbName: ctb.name,
      oldStatus: oldStatus,
      newStatus: selectedValue,
      isNewRow: ctb.isNewRow
    });
    
    // Update the status
    ctb.status = selectedValue;
    
    // Recalculate CTB totals in main table since status affects calculation
    this.updateCTBRow();
    
    console.log('✅ Status change successful and CTB totals recalculated');
    
    // Show message about prioritization effect
    if (selectedValue === 'Prioritized' && oldStatus !== 'Prioritized') {
      this.messageService.add({
        severity: 'info',
        summary: 'Status Updated',
        detail: 'Record marked as Prioritized - now included in main table calculations.',
        life: 5000,
      });
    } else if (oldStatus === 'Prioritized' && selectedValue !== 'Prioritized') {
      this.messageService.add({
        severity: 'info',
        summary: 'Status Updated',
        detail: 'Record no longer Prioritized - removed from main table calculations.',
        life: 5000,
      });
    }
  }

  // CTB Name dropdown options for new rows
  ctbNameOptions: Array<{
    bcId: number;
    planningToolDisplayName: string;
    subInitiativeName: string;
    creationTime: string;
  }> = [];

  ctbRows: Array<{
    name: string;
    columns: { amount: number | null }[];
    status?: string;
    isNewRow?: boolean;
    selectedCTBOption?: any;
  }> = [];

  addCTBRow() {
    // First, load CTB name options from API
    this.http
      .get<any>('http://localhost:3001/newRecordCTBNameDropdDown')
      .subscribe(
        (response) => {
          this.ctbNameOptions = response;

          // Create columns for each month that has data (skip label and total, only include months with data)
          const actualDataColumns =
            this.forecastRows.length > 0
              ? this.forecastRows[0].forecastColumns
                  .slice(1)
                  .filter((col) => col.month != null && col.year != null)
              : [];
          const columns = actualDataColumns.map(() => ({ amount: 0 }));

          // Add new row with isNewRow flag
          this.ctbRows.push({
            name: '',
            columns,
            status: undefined,
            isNewRow: true,
            selectedCTBOption: null,
          });

          this.updateCTBRow();
          // Move paginator to last page after adding
          setTimeout(() => {
            if (this.ctbTableRef && this.ctbRows.length > 5) {
              const totalPages = Math.ceil(this.ctbRows.length / 5);
              this.ctbTableRef.first = (totalPages - 1) * 5;
            }
          }, 100);
        },
        (error) => {
          console.error('Error loading CTB name options:', error);
          // Still add the row even if API fails, fallback to input field
          const actualDataColumns =
            this.forecastRows.length > 0
              ? this.forecastRows[0].forecastColumns
                  .slice(1)
                  .filter((col) => col.month != null && col.year != null)
              : [];
          const columns = actualDataColumns.map(() => ({ amount: 0 }));
          this.ctbRows.push({
            name: '',
            columns,
            status: undefined,
            isNewRow: true,
            selectedCTBOption: null,
          });
          this.updateCTBRow();
          setTimeout(() => {
            if (this.ctbTableRef && this.ctbRows.length > 5) {
              const totalPages = Math.ceil(this.ctbRows.length / 5);
              this.ctbTableRef.first = (totalPages - 1) * 5;
            }
          }, 100);
        }
      );
  }

  // Handle CTB name selection from dropdown
  onCTBNameSelect(ctbIdx: number, selectedOption: any) {
    if (selectedOption) {
      this.ctbRows[ctbIdx].selectedCTBOption = selectedOption;
      this.ctbRows[ctbIdx].name = selectedOption.planningToolDisplayName;
      // Mark as no longer a new row since a selection has been made
      this.ctbRows[ctbIdx].isNewRow = false;
    }
  }

  // Removed stray code from previous patch attempts

  onCTBAmountChange(ctbIdx: number, colIdx: number, value: number) {
    console.log('📋 CTB Cell value changed:', {
      ctbIndex: ctbIdx,
      columnIndex: colIdx,
      newValue: value,
      oldValue: this.ctbRows[ctbIdx]?.columns[colIdx]?.amount
    });
    
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
      forecastedRow.forecastColumns[colIdx + 2] &&
      rtbRow.forecastColumns[colIdx + 2]
    ) {
      const maxValue =
        (forecastedRow.forecastColumns[colIdx + 2].amount || 0) -
        (rtbRow.forecastColumns[colIdx + 2].amount || 0);
      // Calculate sum of only "Prioritized" CTB rows for this month except the current row
      let sumOtherRows = 0;
      for (let i = 0; i < this.ctbRows.length; i++) {
        if (i !== ctbIdx) {
          // Only include other CTB rows that are "Prioritized"
          const otherCtb = this.ctbRows[i];
          if (otherCtb.status === 'Prioritized') {
            sumOtherRows += otherCtb.columns[colIdx].amount || 0;
          }
        }
      }
      // Calculate the max allowed for this input
      const maxAllowedForInput = Math.max(0, maxValue - sumOtherRows);
      if (inputValue > maxAllowedForInput) {
        newValue = maxAllowedForInput;
        this.messageService.add({
          severity: 'warn',
          summary: 'Max Capacity',
          detail: 'Cannot exceed Remaining Capacity!',
          life: 10000,
        });
        // Force input to display corrected value - fix the input selection
        setTimeout(() => {
          const inputs = document.querySelectorAll(
            `#ctb-table tbody tr:nth-child(${ctbIdx + 1}) input[type="number"]`
          );
          const targetInput = inputs[colIdx] as HTMLInputElement;
          if (targetInput) {
            targetInput.value = newValue.toString();
          }
        }, 0);
      }
    }
    // Always set the amount to the validated value
    this.ctbRows[ctbIdx].columns[colIdx].amount = newValue;

    // Track this cell change for saving
    const cellKey = `ctb_${ctbIdx}_${colIdx}`;
    this.changedCTBCells.add(cellKey);
    
    console.log('✅ CTB Cell change tracked:', {
      cellKey: cellKey,
      totalCTBChanges: this.changedCTBCells.size,
      totalMainChanges: this.changedMainTableCells.size,
      hasUnsavedChanges: this.hasUnsavedChanges()
    });

    // If the value was corrected, force update the input field immediately
    if (newValue !== inputValue) {
      setTimeout(() => {
        const inputs = document.querySelectorAll(
          `#ctb-table tbody tr:nth-child(${ctbIdx + 1}) input[type="number"]`
        );
        const targetInput = inputs[colIdx] as HTMLInputElement;
        if (targetInput) {
          targetInput.value = newValue.toString();
          // Also trigger change event to update ngModel
          targetInput.dispatchEvent(new Event('input'));
        }
      }, 0);
    }

    this.updateCTBRow();
  }
  updateCTBRow() {
    // Find the CTB row in forecastRows
    const ctbRow = this.forecastRows.find(
      (r) => r.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)'
    );
    if (!ctbRow) return;
    
    console.log('🔄 Updating CTB row - filtering for Prioritized status only');
    
    // For each month column, sum only "Prioritized" CTB rows and update the top table
    for (let i = 2; i < ctbRow.forecastColumns.length; i++) {
      let sum = 0;
      
      // Only include CTB records with "Prioritized" status
      for (const ctb of this.ctbRows) {
        const isPrioritized = ctb.status === 'Prioritized';
        const amount = typeof ctb.columns[i - 2].amount === 'number' 
          ? ctb.columns[i - 2].amount || 0 
          : 0;
          
        if (isPrioritized) {
          sum += amount;
          console.log('✅ Including Prioritized CTB:', {
            name: ctb.name,
            status: ctb.status,
            columnIndex: i - 2,
            amount: amount
          });
        } else {
          console.log('⏭️ Skipping non-Prioritized CTB:', {
            name: ctb.name,
            status: ctb.status,
            amount: amount
          });
        }
      }
      
      console.log(`📊 Month column ${i - 2} total (Prioritized only):`, sum);
      ctbRow.forecastColumns[i].amount = sum;
    }
  }

  // Helper method to convert column number to Excel column name (A, B, C, ..., Z, AA, AB, etc.)
  private getExcelColumnName(columnNumber: number): string {
    let result = '';
    while (columnNumber > 0) {
      columnNumber--;
      result = String.fromCharCode(65 + (columnNumber % 26)) + result;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return result;
  }

  // Smart save - only calls endpoints for modified data
  saveData() {
    const hasMainTableChanges = this.changedMainTableCells.size > 0;
    const hasCTBTableChanges = this.changedCTBCells.size > 0;

    if (!hasMainTableChanges && !hasCTBTableChanges) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Changes',
        detail: 'No changes to save.',
      });
      return;
    }

    // Determine which endpoints to call
    const saveOperations: any[] = [];
    let saveDescription = '';

    if (hasMainTableChanges && hasCTBTableChanges) {
      // Both tables have changes - call both endpoints
      saveOperations.push(this.saveMainTableData());
      saveOperations.push(this.saveCTBTableData());
      saveDescription = 'both main and CTB tables';
    } else if (hasMainTableChanges) {
      // Only main table has changes - call main table endpoint only
      saveOperations.push(this.saveMainTableData());
      saveDescription = 'main table';
    } else if (hasCTBTableChanges) {
      // Only CTB table has changes - call CTB table endpoint only
      saveOperations.push(this.saveCTBTableData());
      saveDescription = 'CTB table';
    }

    // Show loading message with specific description
    this.messageService.add({
      severity: 'info',
      summary: 'Saving...',
      detail: `Saving changes in ${saveDescription}...`,
    });

    // Execute only the necessary save operations
    forkJoin(saveOperations).subscribe({
      next: (responses) => {
        // Clear change tracking after successful save
        if (hasMainTableChanges) {
          this.changedMainTableCells.clear();
        }
        if (hasCTBTableChanges) {
          this.changedCTBCells.clear();
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Successfully saved changes in ${saveDescription}!`,
        });
      },
      error: (error) => {
        console.error('Error saving data:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to save changes in ${saveDescription}. Please try again.`,
        });
      },
    });
  }

  // Save Main Table (Top Table) Data
  saveMainTableData() {
    const mainTableApiCalls: any[] = [];

    this.forecastRows.forEach((row: any, rowIndex: number) => {
      if (row.forecastColumns) {
        row.forecastColumns.forEach((col: any, colIndex: number) => {
          const cellKey = `main_${rowIndex}_${colIndex}`;

          // Only process if this cell was changed
          if (
            this.changedMainTableCells.has(cellKey) &&
            col.month != null &&
            col.year != null &&
            col.amount != null
          ) {
            const mainTablePayload = {
              id: col.id || 0,
              transformationUnitId: col.transformationUnitId || 679,
              amount: col.amount,
              month: col.month,
              year: col.year,
            };

            // Add API call for main table with dedicated endpoint
            mainTableApiCalls.push(
              this.http.post(
                'http://localhost:3001/saveMainTableData',
                mainTablePayload
              )
            );
          }
        });
      }
    });

    // Return forkJoin of all main table API calls
    return forkJoin(mainTableApiCalls);
  }

  // Save CTB Table (Bottom Table) Data
  saveCTBTableData() {
    const ctbTableApiCalls: any[] = [];

    this.ctbRows.forEach((ctb: any, ctbIndex: number) => {
      if (ctb.columns) {
        ctb.columns.forEach((col: any, colIndex: number) => {
          const cellKey = `ctb_${ctbIndex}_${colIndex}`;

          // Only process if this cell was changed
          if (this.changedCTBCells.has(cellKey)) {
            const monthYearData = this.getMonthYearForCTBColumn(colIndex);

            if (col.amount != null && monthYearData) {
              const ctbTablePayload = {
                id: col.id || 0,
                transformationUnitId: col.transformationUnitId || 679,
                bcId: ctb.selectedCTBOption?.bcId || ctb.bcId || 29,
                amount: col.amount,
                month: monthYearData.month,
                year: monthYearData.year,
                transformationUnitForecastDetailId:
                  col.transformationUnitForecastDetailId || 740,
              };

              // Add API call for CTB table with dedicated endpoint
              ctbTableApiCalls.push(
                this.http.post(
                  'http://localhost:3001/saveCTBTableData',
                  ctbTablePayload
                )
              );
            }
          }
        });
      }
    });

    // Return forkJoin of all CTB table API calls
    return forkJoin(ctbTableApiCalls);
  }

  // Helper method to get month/year for CTB column
  getMonthYearForCTBColumn(
    colIndex: number
  ): { month: number; year: number } | null {
    if (this.forecastRows.length > 0) {
      // Get month/year from the main table structure
      const monthCol = this.forecastRows[0].forecastColumns[colIndex + 2]; // +2 to skip label and total columns
      if (monthCol && monthCol.month != null && monthCol.year != null) {
        return {
          month: monthCol.month,
          year: monthCol.year,
        };
      }
    }
    return null;
  }

  exportToExcel() {
    // Prepare header for main table
    const header = ['Row Label', '', 'Total'];
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
      // Empty column
      rowArr.push('');
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
    const ctbHeader = ['CTB Name', 'Status', 'Total'];

    // Add the 24 months to CTB header (D19 to AA19) - ensuring exactly 24 months are shown
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
      // Status
      const statusValue =
        typeof ctb.status === 'object' && ctb.status
          ? (ctb.status as any).label || (ctb.status as any).value
          : ctb.status || '';
      rowArr.push(statusValue);
      // Total
      rowArr.push(this.getCTBTotal(ctb));
      // Month columns - only add columns that correspond to actual data months
      for (let i = 0; i < ctb.columns.length; i++) {
        rowArr.push(ctb.columns[i].amount != null ? ctb.columns[i].amount : 0);
      }
      return rowArr;
    });

    // Create workbook and worksheets
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Capacity Plan');

    // Add header section (rows 1-7)
    const currentDate = new Date().toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    worksheet.addRow(['PRD0000679: New Product-Leela']);
    worksheet.addRow(['Status', 'Draft']);
    worksheet.addRow(['Date Created', currentDate]);
    worksheet.addRow(['']); // Empty row
    worksheet.addRow(['']); // Empty row
    worksheet.addRow(['']); // Empty row
    worksheet.addRow(['']); // Empty row

    // Add main table header (row 8)
    worksheet.addRow(['Capacity Plan']);
    worksheet.addRow(header);
    dataRows.forEach((row) => worksheet.addRow(row));

    // Merge cells for header section
    worksheet.mergeCells('A1:D1'); // Product name
    worksheet.mergeCells('B2:D2'); // Status row
    worksheet.mergeCells('B3:D3'); // Date Created row

    // Calculate the last column for "Capacity Plan" title based on actual data
    const capacityPlanLastColumn = this.getExcelColumnName(
      3 +
        (this.forecastRows.length > 0
          ? this.forecastRows[0].forecastColumns.filter(
              (col) => col.month != null && col.year != null
            ).length
          : 24)
    );
    worksheet.mergeCells(`A8:${capacityPlanLastColumn}8`); // "Capacity Plan" title

    // Format "Capacity Plan" header
    const capacityPlanCell = worksheet.getCell('A8');
    capacityPlanCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    capacityPlanCell.font = { bold: true };

    // Make A1 bold
    worksheet.getCell('A1').font = { bold: true };

    // Merge cells for main table row labels
    const headerRowIndex = 9; // Row with "Row Label", "Total", etc.
    worksheet.mergeCells(`A${headerRowIndex}:B${headerRowIndex}`);

    // Format main table header row (row 9) - make it bold
    const mainHeaderRow = worksheet.getRow(headerRowIndex);
    mainHeaderRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    // Merge row labels for each data row
    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = headerRowIndex + 1 + i;
      worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
    }

    // Add spacing and CTB Details section
    const ctbStartRow = headerRowIndex + dataRows.length + 1; // Adjusted to place CTB at row 18
    worksheet.addRow(['']); // Empty row (row 14)
    worksheet.addRow(['']); // Empty row (row 15)
    worksheet.addRow(['']); // Empty row (row 16)
    worksheet.addRow(['']); // Empty row (row 17)
    worksheet.addRow(['Capacity Requested By (CTB)']); // Row 18
    worksheet.addRow(ctbHeader); // Row 19

    // Merge CTB section header (row 18) - span only across actual data columns
    const lastColumnLetter = this.getExcelColumnName(ctbHeader.length);
    worksheet.mergeCells(`A18:${lastColumnLetter}18`);
    const ctbTitleCell = worksheet.getCell('A18');
    ctbTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    ctbTitleCell.font = { bold: true, size: 11 };
    ctbTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ctbTitleCell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    // Format CTB header row (row 19) - make it bold
    const ctbHeaderRowIndex = 19;
    const ctbHeaderRow = worksheet.getRow(ctbHeaderRowIndex);
    ctbHeaderRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    if (this.ctbRows.length > 0) {
      ctbDataRows.forEach((row) => worksheet.addRow(row));
    } else {
      worksheet.addRow(['No CTB records found']);
    }

    // Apply formatting to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        // Center align all cells
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Apply borders to most cells, except specific ones
        const shouldRemoveBorder =
          (rowNumber >= 4 && rowNumber <= 7 && colNumber === 1) || // A4:A7
          (rowNumber >= 14 && rowNumber <= 17 && colNumber === 1) || // A14:A17 - no border
          (rowNumber >= 14 && rowNumber <= 15 && colNumber === 2); // B14:B15

        if (!shouldRemoveBorder) {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
          };
        }
      });
    });

    // Make specific cells bold and adjust formatting
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A3').font = { bold: true };

    // Set column widths
    worksheet.getColumn('A').width = 20;
    worksheet.getColumn('B').width = 12;
    worksheet.getColumn('C').width = 12;

    // Set width for monthly columns
    for (let i = 4; i <= 30; i++) {
      worksheet.getColumn(i).width = 10;
    }

    // Re-apply specific formatting after general formatting to ensure it takes precedence

    // Re-format "Capacity Plan" header (row 8)
    const capacityPlanCellFinal = worksheet.getCell('A8');
    capacityPlanCellFinal.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    capacityPlanCellFinal.font = { bold: true };

    // Re-format main table header row (row 9)
    const mainHeaderRowFinal = worksheet.getRow(9);
    mainHeaderRowFinal.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    // Re-format CTB title (row 18) - ensure formatting is applied
    const ctbTitleCellFinal = worksheet.getCell('A18');
    ctbTitleCellFinal.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    ctbTitleCellFinal.font = { bold: true, size: 11 };
    ctbTitleCellFinal.alignment = { horizontal: 'center', vertical: 'middle' };
    ctbTitleCellFinal.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    // Re-format CTB header row (row 19)
    const ctbHeaderRowFinal = worksheet.getRow(19);
    ctbHeaderRowFinal.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    // Ensure CTB data rows have no background color (clear any inherited formatting)
    if (this.ctbRows.length > 0) {
      const ctbDataStartRow = 20; // Row 20 onwards
      for (let i = 0; i < this.ctbRows.length; i++) {
        const dataRow = worksheet.getRow(ctbDataStartRow + i);
        dataRow.eachCell((cell) => {
          // Clear any background fill for data rows
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }, // White background
          };
        });
      }
    }

    workbook.xlsx.writeBuffer().then((buffer) => {
      saveAs(new Blob([buffer]), 'capacity_plan.xlsx');
    });
  }

  // Navigation method for testing unsaved changes protection
  navigateToTestPage(): void {
    console.log('🚀 Attempting navigation to test page');
    console.log('📊 Current unsaved changes status:', this.hasUnsavedChanges());
    console.log('📝 Main table changes:', this.changedMainTableCells.size);
    console.log('📋 CTB changes:', this.changedCTBCells.size);
    console.log('🔒 Allow navigation flag:', this.allowNavigation);
    
    this.router.navigate(['/redirect-test']);
  }

  isInputDisabled(
    row: ForecastRow,
    col: ForecastColumn,
    monthIdx: number
  ): boolean {
    // Always allow decrease
    return false;
  }

  // onAmountChange(
  //   row: ForecastRow,
  //   col: ForecastColumn,
  //   monthIdx: number,
  //   newValue: number
  // ) {
  //   const max = this.getMaxAllowed(row, monthIdx);
  //   if (newValue < 0) {
  //     col.amount = null;
  //     return;
  //   }
  //   if (newValue > max) {
  //     this.messageService.add({
  //       severity: 'warn',
  //       summary: 'Max Capacity',
  //       detail: 'Maximum capacity reached!',
  //       life: 2000,
  //     });
  //     col.amount = max; // Set to max instead of resetting to zero
  //     return;
  //   }
  //   // Prevent Capacity Requested by (CTB) from exceeding Remaining Capacity
  //   if (row.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)') {
  //     // Find Remaining Capacity row for the same column
  //     const remainingRow = this.forecastRows.find(
  //       (r) => r.forecastColumns[0].rowLabel === 'Remaining Capacity'
  //     );
  //     if (remainingRow && remainingRow.forecastColumns[monthIdx]) {
  //       const maxValue = remainingRow.forecastColumns[monthIdx].amount ?? 0;
  //       if (newValue > maxValue) {
  //         col.amount = maxValue;
  //         // Optionally show a message/toast here
  //         return;
  //       }
  //     }
  //   }
  //   col.amount = newValue;
  // }

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
  isLoading: boolean = true;

  // Change tracking for saving only modified cells
  public changedMainTableCells: Set<string> = new Set();
  public changedCTBCells: Set<string> = new Set();

  // Navigation control flag
  private allowNavigation: boolean = false;

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.isLoading = true;

    // Initialize history state for popstate handling
    window.history.replaceState(null, '', window.location.href);

    // Add 3-second delay for testing
    setTimeout(() => {
      this.loadData();
    }, 3000);
  }

  // Check if there are unsaved changes
  hasUnsavedChanges(): boolean {
    return this.changedMainTableCells.size > 0 || this.changedCTBCells.size > 0;
  }

  // Handle browser refresh/close attempts - must show native dialog for security
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.hasUnsavedChanges()) {
      // For beforeunload, we must use native dialog due to browser security
      // This is the only way to prevent page refresh/close
      const confirmationMessage =
        'You have unsaved changes that will be lost. Are you sure you want to leave?';
      $event.returnValue = confirmationMessage;
    }
  }

  // Handle browser history navigation (back/forward buttons)
  @HostListener('window:popstate', ['$event'])
  onPopState($event: any): void {
    if (!this.allowNavigation && this.hasUnsavedChanges()) {
      // Push current state back to prevent navigation
      window.history.pushState(null, '', window.location.href);

      // Show PrimeNG dialog for browser navigation
      this.showNavigationConfirmDialog();
    }
  }

  // Handle Angular router navigation attempts
  canDeactivate(): boolean | Promise<boolean> {
    console.log('🛡️ canDeactivate called - checking unsaved changes');
    console.log('📊 Has unsaved changes:', this.hasUnsavedChanges());
    console.log('📝 Main table changes:', this.changedMainTableCells.size);
    console.log('📋 CTB changes:', this.changedCTBCells.size);
    
    if (this.hasUnsavedChanges()) {
      console.log('⚠️ Showing confirmation dialog for navigation');
      return new Promise((resolve) => {
        this.confirmationService.confirm({
          message:
            'You have unsaved changes that will be lost. Do you want to save before leaving?',
          header: 'Unsaved Changes',
          icon: 'pi pi-exclamation-triangle',
          acceptButtonStyleClass: 'p-button-success',
          rejectButtonStyleClass: 'p-button-danger',
          acceptLabel: 'Save & Leave',
          rejectLabel: 'Leave Without Saving',
          accept: () => {
            console.log('✅ User chose to save and leave');
            // Save data and then allow navigation
            this.saveDataAndLeave(resolve);
          },
          reject: () => {
            console.log('❌ User chose to leave without saving');
            // Leave without saving
            this.clearChangeTracking();
            resolve(true);
          },
        });
      });
    }
    console.log('✅ No unsaved changes - allowing navigation');
    return true;
  }

  // Save data and then allow navigation
  private saveDataAndLeave(resolve: (value: boolean) => void): void {
    const hasMainTableChanges = this.changedMainTableCells.size > 0;
    const hasCTBTableChanges = this.changedCTBCells.size > 0;

    const saveOperations: any[] = [];

    if (hasMainTableChanges) {
      saveOperations.push(this.saveMainTableData());
    }

    if (hasCTBTableChanges) {
      saveOperations.push(this.saveCTBTableData());
    }

    if (saveOperations.length > 0) {
      forkJoin(saveOperations).subscribe({
        next: (responses) => {
          this.clearChangeTracking();
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Changes saved successfully before leaving.',
          });
          resolve(true);
        },
        error: (error) => {
          console.error('Error saving data before leaving:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Save Failed',
            detail: 'Failed to save changes. Please try again.',
          });
          resolve(false);
        },
      });
    } else {
      resolve(true);
    }
  }

  // Clear all change tracking
  private clearChangeTracking(): void {
    this.changedMainTableCells.clear();
    this.changedCTBCells.clear();
    this.allowNavigation = false; // Reset navigation flag
  }

  // Method to manually show the confirm dialog for testing
  showConfirmDialog(): void {
    console.log('🔥 SHOWING PRIMENG CONFIRM DIALOG 🔥');
    console.log('ConfirmationService:', this.confirmationService);

    this.confirmationService.confirm({
      message:
        '🚨 This is the PrimeNG ConfirmDialog! 🚨<br/>You have unsaved changes that will be lost. Do you want to save before leaving?',
      header: '🎯 PrimeNG Dialog Test',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Save & Leave',
      rejectLabel: 'Leave Without Saving',
      accept: () => {
        console.log('✅ User clicked ACCEPT');
        this.messageService.add({
          severity: 'success',
          summary: 'Accept Clicked!',
          detail: 'You chose to save and leave - PrimeNG Dialog Working!',
        });
      },
      reject: () => {
        console.log('❌ User clicked REJECT');
        this.messageService.add({
          severity: 'warn',
          summary: 'Reject Clicked!',
          detail: 'You chose to leave without saving - PrimeNG Dialog Working!',
        });
      },
    });

    console.log('📝 ConfirmDialog.confirm() method called');
  }

  // Method to show PrimeNG dialog for browser navigation
  showNavigationConfirmDialog(): void {
    console.log('🌐 SHOWING NAVIGATION CONFIRM DIALOG 🌐');

    this.confirmationService.confirm({
      message:
        'You have unsaved changes that will be lost. Do you want to save before leaving?',
      header: 'Unsaved Changes - Navigation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Save & Leave',
      rejectLabel: 'Leave Without Saving',
      accept: () => {
        console.log('✅ User chose to save and leave via navigation');
        this.saveDataAndNavigate();
      },
      reject: () => {
        console.log('❌ User chose to leave without saving via navigation');
        this.clearChangeTracking();
        this.navigateAway();
      },
    });
  }

  // Save data and then navigate away
  private saveDataAndNavigate(): void {
    const hasMainTableChanges = this.changedMainTableCells.size > 0;
    const hasCTBTableChanges = this.changedCTBCells.size > 0;

    const saveOperations: any[] = [];

    if (hasMainTableChanges) {
      saveOperations.push(this.saveMainTableData());
    }

    if (hasCTBTableChanges) {
      saveOperations.push(this.saveCTBTableData());
    }

    if (saveOperations.length > 0) {
      forkJoin(saveOperations).subscribe({
        next: (responses) => {
          this.clearChangeTracking();
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Changes saved successfully.',
          });
          // Allow navigation after saving
          this.navigateAway();
        },
        error: (error) => {
          console.error('Error saving data before navigation:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Save Failed',
            detail: 'Failed to save changes. Navigation cancelled.',
          });
        },
      });
    } else {
      this.navigateAway();
    }
  }

  // Navigate away from the page
  private navigateAway(): void {
    // Set flag to allow navigation
    this.allowNavigation = true;

    // Clear change tracking
    this.clearChangeTracking();

    // Use a small timeout to ensure the flag is set before navigation
    setTimeout(() => {
      window.history.back();
    }, 10);
  }

  private loadData() {
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

        // Load bottom table after top table is loaded
        this.callBottomTable();
      });
  }

  callBottomTable() {
    this.http.get<any>('http://localhost:3001/capacityBottom').subscribe(
      (data) => {
        let rows = Array.isArray(data) ? data : data.result || data.rows || [];
        this.ctbRows = rows.map((row: any) => {
          const forecastColumns = row.forecastColumns || [];
          const name =
            forecastColumns.length > 0 ? forecastColumns[0].rowLabel || '' : '';
          const statusCol = forecastColumns.find(
            (col: any) => col.columnLabel === 'Status'
          );
          
          // Get the status value from the status column
          const statusValue = statusCol?.status || '';
          console.log('🔍 Loading CTB row:', {
            name: name,
            statusValue: statusValue,
            statusCol: statusCol,
            forecastColumns: forecastColumns
          });
          
          // Find matching status option object (need to match by value, not create new object)
          const statusOption = statusValue ? 
            this.ctbStatusOptions?.find((opt: any) => opt.value === statusValue) || statusValue
            : null;
            
          console.log('📋 Status binding result:', {
            statusValue: statusValue,
            statusOption: statusOption,
            availableOptions: this.ctbStatusOptions
          });
          const totalCol = forecastColumns.find(
            (col: any) => col.columnLabel === 'Total'
          );
          const monthAmounts =
            this.forecastRows.length > 0
              ? this.forecastRows[0].forecastColumns
                  .slice(1)
                  .filter((col) => col.month != null && col.year != null)
                  .map((col: any) => {
                    const matchingCol = forecastColumns.find(
                      (c: any) => c.columnLabel === col.columnLabel
                    );
                    return { amount: matchingCol?.amount || 0 };
                  })
              : [];
          return {
            name,
            status: statusValue, // Store the actual status value, not the option object
            columns: monthAmounts,
            isNewRow: false, // Existing rows are not new
            selectedCTBOption: null,
          };
        });

        // Both tables are loaded, hide spinner
        this.isLoading = false;
      },
      (error) => {
        console.error('Failed to fetch CTB table data:', error);
        // Hide spinner even on error
        this.isLoading = false;
      }
    );
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

  onAmountChange(row: any, col: any, i: number, newValue: number) {
    console.log('📝 Cell value changed:', {
      rowLabel: row.forecastColumns[0].rowLabel,
      columnIndex: i,
      newValue: newValue,
      oldValue: col.amount
    });
    
    // Prevent negative values
    if (newValue < 0) {
      col.amount = 0;
      // Force input to update its display
      setTimeout(() => {
        const input = document.activeElement as HTMLInputElement;
        if (input && input.type === 'number') {
          input.value = '0';
        }
      }, 0);
      return;
    }

    // Check remaining capacity constraint for RTB and CTB rows
    const rowLabel = row.forecastColumns[0].rowLabel;
    if (rowLabel === 'RTB' || rowLabel === 'Capacity Requested by (CTB)') {
      // Calculate remaining capacity for this month
      const forecastedRow = this.forecastRows.find((r: any) =>
        r.forecastColumns[0].rowLabel?.includes('Forecasted')
      );
      const rtbRow = this.forecastRows.find(
        (r: any) => r.forecastColumns[0].rowLabel === 'RTB'
      );
      const ctbRow = this.forecastRows.find(
        (r: any) =>
          r.forecastColumns[0].rowLabel === 'Capacity Requested by (CTB)'
      );

      if (
        forecastedRow &&
        rtbRow &&
        ctbRow &&
        forecastedRow.forecastColumns[i]
      ) {
        const forecasted = forecastedRow.forecastColumns[i].amount || 0;
        const currentRtb = rtbRow.forecastColumns[i].amount || 0;
        const currentCtb = ctbRow.forecastColumns[i].amount || 0;

        // Calculate max allowed based on which row is being edited
        let maxAllowed = 0;
        if (rowLabel === 'RTB') {
          maxAllowed = forecasted - currentCtb;
        } else {
          // CTB
          maxAllowed = forecasted - currentRtb;
        }

        if (newValue > maxAllowed) {
          const correctedValue = Math.max(0, maxAllowed);
          col.amount = correctedValue;
          this.messageService.add({
            severity: 'warn',
            summary: 'Max Capacity',
            detail: 'Cannot exceed Remaining Capacity!',
            life: 10000,
          });
          // Force input to update its display to the corrected value
          setTimeout(() => {
            const input = document.activeElement as HTMLInputElement;
            if (input && input.type === 'number') {
              input.value = correctedValue.toString();
            }
          }, 0);
          return;
        }
      }
    }

    col.amount = newValue;

    // Track this cell change for saving
    const rowIndex = this.forecastRows.indexOf(row);
    const cellKey = `main_${rowIndex}_${i}`;
    this.changedMainTableCells.add(cellKey);
    
    console.log('✅ Cell change tracked:', {
      cellKey: cellKey,
      totalChanges: this.changedMainTableCells.size,
      hasUnsavedChanges: this.hasUnsavedChanges()
    });
  }
}
