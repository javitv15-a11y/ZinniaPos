import { Component, input, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { OrderStatusValue, OriginOfOrder } from "src/app/core/consts/enums/business/order.enum";
import { OrderStatusLabel } from './order-list.consts';
import { addIcons } from 'ionicons';
import { chevronForwardOutline } from 'ionicons/icons';
import { IonicModule } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common';
import { IOrder } from 'src/app/core/interfaces/bussiness/order.interface';
import { OrderService } from 'src/app/core/services/bussiness/order.service';
import { IUser } from 'src/app/core/interfaces/bussiness/user.interface';
import { LoadingService } from 'src/app/core/services/utils/loading.service';
import { ordersGetMessages, waitingMessageOrderLoading } from '../../orders.consts';
import { ToastService } from 'src/app/core/services/utils/toast.service';
import { AuthSessionService } from 'src/app/core/services/utils/auth-session.service';

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
  ],
  providers: [DatePipe]
})
export class OrderListComponent implements OnInit, OnChanges  {

  @Input() orders: IOrder[] = [];

  public ordersToday: IOrder[] = [];
  public ordersByDay: { key: string; date: Date; dayLabel: string; headerLabel: string; orders: IOrder[] }[] = [];

  private _loggedUser: IUser | null = null;

  constructor(
    private datePipe: DatePipe,
    private _orderService: OrderService,
    private _toastService: ToastService,
    private _loadingService: LoadingService,
    private _authSessionService: AuthSessionService,
  ) {
    addIcons({
      chevronForwardOutline
    });
  }

  ngOnInit() {
    this.groupOrdersByDate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orders']) {
      this.groupOrdersByDate();
    }
  }

  public getOrderStatusLabel(orderStatus: OrderStatusValue): string {
    return OrderStatusLabel[orderStatus];
  }

  public getStatusClass(orderStatus: OrderStatusValue): string {
    return `status-${orderStatus}`;
  }

  public showOriginIcon(orderOrigin: OriginOfOrder): boolean {
    return orderOrigin === OriginOfOrder.WHATSAPP;
  }

  public trackByOrderId(_index: number, order: IOrder): string {
    return order.id;
  }

  public trackByGroupKey(_index: number, group: { key: string }): string {
    return group.key;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  private pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }

  private localDateKey(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  private groupOrdersByDate(): void {
    const today = new Date();

    
    const sorted = [...this.orders].sort((a, b) =>
      new Date(b.createAt).getTime() - new Date(a.createAt).getTime()
    );

    
    this.ordersToday = sorted.filter(o => this.isSameDay(new Date(o.createAt), today));

  
    const groups: Record<string, { date: Date; orders: IOrder[] }> = {};

    sorted
      .filter(o => !this.isSameDay(new Date(o.createAt), today))
      .forEach(o => {
        const d = new Date(o.createAt);
        const key = this.localDateKey(d); 
        if (!groups[key]) {
          groups[key] = { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), orders: [] };
        }
        groups[key].orders.push(o);
      });

    
    this.ordersByDay = Object.entries(groups)
      .map(([key, { date, orders }]) => ({
        key,
        date,
        dayLabel: this.datePipe.transform(date, 'EEEE') ?? '',
        headerLabel: this.datePipe.transform(date, 'EEEE d MMM, y') ?? '',
        orders: orders.sort((a, b) => new Date(b.createAt).getTime() - new Date(a.createAt).getTime())
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

}
