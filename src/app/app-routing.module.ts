import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CapacityPlannerComponent } from './capacity-planner.component';
import { RedirectTestComponent } from './redirect-test.component';
import { UnsavedChangesGuard } from './unsaved-changes.guard';

const routes: Routes = [
  { 
    path: '', 
    component: CapacityPlannerComponent,
    canDeactivate: [UnsavedChangesGuard]
  },
  { 
    path: 'capacity-planner', 
    component: CapacityPlannerComponent,
    canDeactivate: [UnsavedChangesGuard]
  },
  { path: 'redirect-test', component: RedirectTestComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
