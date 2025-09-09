import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CapacityPlannerComponent } from './capacity-planner.component';
import { RedirectTestComponent } from './redirect-test.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { capacityReducer } from './state/capacity.reducer';
import { CapacityEffects } from './state/capacity.effects';

@NgModule({
  declarations: [AppComponent, CapacityPlannerComponent, RedirectTestComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    ToastModule,
    DropdownModule,
    DialogModule,
    ProgressSpinnerModule,
    ConfirmDialogModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    StoreModule.forRoot({ capacity: capacityReducer }),
    EffectsModule.forRoot([CapacityEffects]),
    StoreDevtoolsModule.instrument({ maxAge: 25 }),
  ],
  providers: [MessageService, ConfirmationService],
  bootstrap: [AppComponent],
})
export class AppModule {}
