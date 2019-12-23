import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { Router } from '@angular/router';
import {  ToasterService  } from '@sunbird/shared';
import * as _ from 'lodash-es';

@Component({
  selector: 'app-select-textbook',
  templateUrl: './select-textbook.component.html',
  styleUrls: ['./select-textbook.component.scss']
})
export class SelectTextbookComponent implements OnInit {

  @Input() config: any;
  @Input() sessionContext: any;
  @Output() selectedClassSubjectEvent = new EventEmitter<any>();
  public filtersDetails: any;
  public selectedOptions: any = {};
  telemetryImpression = {};
  telemetryInteract = {};

  constructor(public router: Router, private toasterService: ToasterService) { }

  ngOnInit() {
    this.filtersDetails = {
      gradeLevel: _.map(_.get(this.config, 'scope.gradeLevel'), item => ({ name: item, code: item })),
      subject: _.map(_.get(this.config, 'scope.subject'), item => ({ name: item, code: item }))
    };
    this.selectedOptions = {
      gradeLevel: this.sessionContext.gradeLevel,
      subject: this.sessionContext.subject
    };
    this.setTelemetryImpression();
    this.telemetryInteract = {
      id: 'search_textbook',
      type: 'click',
      pageid: 'searchtextbooks',
      extra: this.selectedOptions
    };
  }

  emitSelectedTextbook() {
    if (this.selectedOptions.gradeLevel === undefined || this.selectedOptions.subject === undefined) {
      this.toasterService.error('Please select Class & Subject');
    } else {
      this.selectedClassSubjectEvent.emit(this.selectedOptions);
    }

  }

  private setTelemetryImpression() {
    this.telemetryImpression = {
      context: {
        env: 'cbse_program'
      },
      edata: {
        type: 'view',
        pageid: 'searchtextbook',
        uri: this.router.url,
      }
    };
  }
}
