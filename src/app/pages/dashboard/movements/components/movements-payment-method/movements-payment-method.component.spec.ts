import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MovementsPaymentMethodComponent } from './movements-payment-method.component';

describe('MovementsPaymentMethodComponent', () => {
  let component: MovementsPaymentMethodComponent;
  let fixture: ComponentFixture<MovementsPaymentMethodComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MovementsPaymentMethodComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsPaymentMethodComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
