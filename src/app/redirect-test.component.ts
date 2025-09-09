import { Component } from '@angular/core';

@Component({
  selector: 'app-redirect-test',
  template: `
    <div class="redirect-test-container">
      <h2>Redirect Test Page</h2>
      <p>This page is used for testing navigation protection functionality.</p>

      <div class="test-actions">
        <button
          type="button"
          class="p-button p-button-primary"
          (click)="goBackToCapacityPlanner()"
        >
          Go Back to Capacity Planner
        </button>

        <button
          type="button"
          class="p-button p-button-secondary"
          (click)="navigateToHome()"
          style="margin-left: 10px;"
        >
          Navigate to Home
        </button>
      </div>

      <div class="test-info">
        <h3>Testing Instructions:</h3>
        <ol>
          <li>Go back to Capacity Planner</li>
          <li>Make some changes to the data (edit cells)</li>
          <li>Try to navigate back here using browser back button</li>
          <li>
            Check if PrimeNG dialog appears instead of native browser dialog
          </li>
        </ol>
      </div>
    </div>
  `,
  styles: [
    `
      .redirect-test-container {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
      }

      .test-actions {
        margin: 20px 0;
      }

      .test-info {
        margin-top: 30px;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 5px;
        border-left: 4px solid #007bff;
      }

      .test-info h3 {
        color: #007bff;
        margin-top: 0;
      }

      .test-info ol {
        line-height: 1.6;
      }

      .p-button {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }

      .p-button-primary {
        background-color: #007bff;
        color: white;
      }

      .p-button-secondary {
        background-color: #6c757d;
        color: white;
      }

      .p-button:hover {
        opacity: 0.9;
      }
    `,
  ],
})
export class RedirectTestComponent {
  constructor() {}

  goBackToCapacityPlanner(): void {
    // Use browser history to go back
    window.history.back();
  }

  navigateToHome(): void {
    // Navigate to root/home
    window.location.href = '/';
  }
}
