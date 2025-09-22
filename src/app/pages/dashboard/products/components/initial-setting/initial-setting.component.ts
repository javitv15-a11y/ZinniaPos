import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { MenuHeaderComponent } from 'src/app/shared/components/menu-header/menu-header.component';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { QuickAccessPanelComponent } from 'src/app/shared/components/quick-access-panel/quick-access-panel.component';
import { ProgressListComponent } from 'src/app/shared/components/progress-list/progress-list.component';

import { InitialBusinessSettingService } from 'src/app/core/services/utils/initial-setting.service';
import { IListTask } from 'src/app/core/consts/types/progress-list.type';
import { settingHeader } from '././initial-setting.consts'; 

@Component({
  selector: 'app-products-initial-setting',
  standalone: true,
  templateUrl: './initial-setting.component.html',
  styleUrls: ['./initial-setting.component.scss'],
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    QuickAccessPanelComponent,
    ProgressListComponent,
  ],
})
export class InitialSettingComponent implements OnInit {
  public settingHeader = settingHeader;
  public initialTask: IListTask[] = [];

  constructor(
    private _modalCtrl: ModalController,
    private _initialSettingSrv: InitialBusinessSettingService
  ) {}

  ngOnInit(): void {
    this.initialTask = this._initialSettingSrv.getInitialUserTask();
  }

  
  public actionCompleted(): void {
    this._modalCtrl.dismiss({ completed: true });
  }
}
