import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
// import { CapacityRow } from './capacity-planner.component';

@Injectable({ providedIn: 'root' })
export class CapacityService {
  private apiUrl = 'http://localhost:3000/capacity';

  constructor(private http: HttpClient) {}

  load(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  save(rows: any[]): Observable<any> {
    // PATCH each row individually by index
    const requests = rows.map((row, i) =>
      this.http.patch(`${this.apiUrl}/${i + 1}`, row)
    );
    return forkJoin(requests);
  }
}
