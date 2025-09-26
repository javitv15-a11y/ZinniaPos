import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MovementsPurchaseSupplierComponent } from './movements-purchase-supplier.component';

describe('MovementsPurchaseSupplierComponent', () => {
  let component: MovementsPurchaseSupplierComponent;
  let fixture: ComponentFixture<MovementsPurchaseSupplierComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MovementsPurchaseSupplierComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsPurchaseSupplierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
