import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { MenuHeaderComponent } from 'src/app/shared/components/menu-header/menu-header.component';

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.component.html',
  styleUrls: ['./appointments.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
  ],
  providers: [
    ModalController
  ]
})
export class AppointmentsComponent implements OnInit {

  public selectedSegment = '';

  constructor(
    private readonly _router: Router,
  ) { }

  ngOnInit(): void {
    this.selectedSegment = this._router.url;
  }

  ionViewWillEnter() {
    this.selectedSegment = this._router.url;
  }

}
