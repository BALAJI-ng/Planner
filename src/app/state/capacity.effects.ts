import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { CapacityService } from '../capacity.service';
import * as CapacityActions from './capacity.actions';
import { catchError, map, mergeMap, of } from 'rxjs';

@Injectable()
export class CapacityEffects {
  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CapacityActions.loadCapacity),
      mergeMap(() =>
        this.capacityService.load().pipe(
          map((rows) =>
            CapacityActions.loadCapacitySuccess({ rows: rows as any })
          ),
          catchError((error) =>
            of(CapacityActions.loadCapacityFailure({ error }))
          )
        )
      )
    )
  );

  save$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CapacityActions.saveCapacity),
      mergeMap((action) =>
        this.capacityService.save(action.rows).pipe(
          map(() => CapacityActions.saveCapacitySuccess()),
          catchError((error) =>
            of(CapacityActions.saveCapacityFailure({ error }))
          )
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private capacityService: CapacityService
  ) {}
}
