import { Component, OnInit, ViewChild, ElementRef, OnDestroy, AfterViewInit, Input } from '@angular/core';
import { ResourceService, ToasterService, ServerResponse, ConfigService, NavigationHelperService } from '@sunbird/shared';
import { OrgManagementService } from '../../../org-management/services/org-management/org-management.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IInteractEventInput, IImpressionEventInput, IInteractEventEdata, IInteractEventObject } from '@sunbird/telemetry';
import { UserService } from '@sunbird/core';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import * as _ from 'lodash-es';
import { CbseProgramService } from '../../services/cbse-program/cbse-program.service';
import { CbseComponent } from '../cbse/cbse.component';
/**
 * This component helps to upload bulk users data (csv file)
 *
 * This component also creates a unique process id on success upload of csv file
 */
@Component({
  moduleId: module.id,
  selector: 'app-csv-upload',
  templateUrl: 'csv-upload.component.html',
  styleUrls: ['csv-upload.component.scss']
})
export class CsvUploadComponent implements OnDestroy, OnInit {
  @ViewChild('inputbtn') inputbtn: ElementRef;
  @ViewChild('modal') modal;
  @Input() certType: string;
  /**
  *Element Ref  for copyLinkButton;
  */
  @ViewChild('copyErrorData') copyErrorButton: ElementRef;
  public userId: any;
  public rootOrgId: any;
  /**
* reference of config service.
*/
  public config: ConfigService;
  /**
* contains upload instructions in an array
*/
  userUploadInstructions: Array<any>;
  /**
* To call admin service which helps to upload csv file
*/
  public orgManagementService: OrgManagementService;
  public cbseProgramService: CbseProgramService;
  public userService: UserService;
  public cbseComponent: CbseComponent;
  /**
* Contains process id
*/
  processId: string;
  /**
* Used to display filename in html
*/
  fileName: string;
  /**
* Used to show/hide error message
*/
  bulkUploadError: boolean;
  /**
* Contains error message to show in html
*/
  bulkUploadErrorMessage: string;
  /**
* To show/hide loader
*/
  showLoader: boolean;
  /**
  * To show / hide modal
  */
  modalName = 'upload';
  /**
   * Upload org form name
   */
  uploadUserForm: FormGroup;
  /**
 * Contains reference of FormBuilder
 */
  sbFormBuilder: FormBuilder;
  /**
* error object
*/
  errors: [];
  /**
 * error object
 */
  error: '';
  file: any;
  activateUpload = false;

  /**
   * To call resource service which helps to use language constant
   */
  public resourceService: ResourceService;
  /**
 * To show toaster(error, success etc) after any API calls
 */
  private toasterService: ToasterService;
  /**
* Contains redirect url
*/
  redirectUrl: string;
  /**
	 * telemetryImpression
	*/
  telemetryImpression: IImpressionEventInput;
  userUploadInteractEdata: IInteractEventEdata;
  downloadCSVInteractEdata: IInteractEventEdata;
  telemetryInteractObject: IInteractEventObject;
  public unsubscribe$ = new Subject<void>();
  /**
* Constructor to create injected service(s) object
*
* Default method of DetailsComponent class
*
* @param {ResourceService} resourceService To call resource service which helps to use language constant
*/
  csvOptions = {
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalseparator: '.',
    showLabels: true,
    headers: []
  };
  constructor(cbseComponent: CbseComponent, cbseProgramService: CbseProgramService, orgManagementService: OrgManagementService,
    config: ConfigService, formBuilder: FormBuilder, toasterService: ToasterService,
    resourceService: ResourceService, userService: UserService,
    public navigationhelperService: NavigationHelperService) {
    this.cbseComponent = cbseComponent;
    this.resourceService = resourceService;
    this.sbFormBuilder = formBuilder;
    this.orgManagementService = orgManagementService;
    this.cbseProgramService = cbseProgramService;
    this.userService = userService;
    this.toasterService = toasterService;
    this.config = config;
  }
  /**
 * This method initializes the user form and validates it,
 * also defines array of instructions to be displayed
 */
  ngOnInit() {
    this.userService.userData$.pipe(first()).subscribe(user => {
      if (user && user.userProfile) {
        this.userId = user.userProfile.userId;
        this.rootOrgId = user.userProfile.rootOrgId;
      }
    });
    console.log(this.certType);
    console.log(this.userId);
    console.log(this.rootOrgId);
    this.uploadUserForm = this.sbFormBuilder.group({
      provider: ['', null],
      externalId: ['', null],
      organisationId: ['', null]
    });
    this.userUploadInstructions = [
      { instructions: 'Write the school name or the student name (depending on the certificate type) in the "Name" column' },
      { instructions: 'The State has provided your school  with a unique ID. Write this ID in the "School External ID" column' },
      { instructions: 'Make sure that there is only one record per row' },
      { instructions: 'Maximum records per file is 300' },
      { instructions: 'Save the file as .csv ' },
      // // { instructions: this.resourceService.frmelmnts.instn.t0101 },
      // { instructions: this.resourceService.frmelmnts.instn.t0102 },
      // { instructions: this.resourceService.frmelmnts.instn.t0103 },
      // { instructions: this.resourceService.frmelmnts.instn.t0104 },
      // { instructions: this.resourceService.frmelmnts.instn.t0105 }
    ];
    this.showLoader = false;
    this.setInteractEventData();
  }
  /**
 * This method helps to redirect to the parent component
 * page, i.e, bulk upload page
 */
  public redirect() {
    this.fileName = '';
    this.processId = '';
  }
  /**
  * This method helps to call uploadOrg method to upload a csv file
  */
  openImageBrowser(inputbtn) {
    this.bulkUploadError = false;
    this.bulkUploadErrorMessage = '';
    inputbtn.click();
  }
  fileChanged(event) {
    this.file = event.target.files[0];
    this.activateUpload = true;
  }
  /**
  * This method helps to upload a csv file and return process id
  */
  uploadUsersCSV() {
    const file = this.file;
    const data = this.uploadUserForm.value;
    if (file && file.name.match(/.(csv)$/i)) {
      this.showLoader = true;
      this.cbseProgramService.postCertData(file, this.certType, this.userId, this.rootOrgId)
        .subscribe(
          apiResponse => {
            console.log(apiResponse);
            this.showLoader = false;
            this.toasterService.success('File uploaded successfully');
            this.modal.deny();
            this.cbseComponent.selectedOption = '';
          },
          err => {
            console.log(err);
            this.showLoader = false;
            const errorMsg = _.get(err, 'error.params.errmsg') ? _.get(err, 'error.params.errmsg').split(/\../).join('.<br/>') :
              this.resourceService.messages.fmsg.m0051;
            this.error = errorMsg.replace('[', '').replace(']', '').replace(/\,/g, ',\n');
            this.errors = errorMsg.replace('[', '').replace(']', '').split(',');
            this.modalName = 'error';
            this.cbseComponent.selectedOption = '';
          },
          () => {
            console.log('Finally...');
          }
        );
      // const formData = new FormData();
      // formData.append('user', file);
      // const fd = formData;
      // this.fileName = file.name;
      // this.orgManagementService.bulkUserUpload(fd).pipe(
      //   takeUntil(this.unsubscribe$))
      //   .subscribe(
      //     (apiResponse: ServerResponse) => {
      //       this.showLoader = false;
      //       this.processId = apiResponse.result.processId;
      //       this.toasterService.success(this.resourceService.messages.smsg.m0030);
      //       this.modal.deny();
      //     },
      //     err => {
      //       this.showLoader = false;
      //       const errorMsg = _.get(err, 'error.params.errmsg') ? _.get(err, 'error.params.errmsg').split(/\../).join('.<br/>') :
      //       this.resourceService.messages.fmsg.m0051;
      //       this.error = errorMsg.replace('[', '').replace(']', '').replace(/\,/g, ',\n');
      //       this.errors = errorMsg.replace('[', '').replace(']', '').split(',');
      //       this.modalName = 'error';
      //     });
    } else if (file && !(file.name.match(/.(csv)$/i))) {
      this.showLoader = false;
      this.toasterService.error(this.resourceService.messages.stmsg.m0080);
    }
  }
  /**
  * This method is used to show error message
  */
  closeBulkUploadError() {
    this.bulkUploadError = false;
    this.bulkUploadErrorMessage = '';
  }
  copyToClipboard() {
    const element = (<HTMLInputElement>document.getElementById('errorTextArea'));
    element.value = '';
    element.value = this.error;
    element.select();
    document.execCommand('copy');
  }
  ngOnDestroy() {
    document.body.classList.remove('no-scroll'); // This is a workaround we need to remove it when library add support to remove body scroll
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
  setInteractEventData() {
    this.userUploadInteractEdata = {
      id: 'upload-user',
      type: 'click',
      pageid: 'profile-read'
    };
    this.downloadCSVInteractEdata = {
      id: 'download-sample-user-csv',
      type: 'click',
      pageid: 'profile-read'
    };
    this.telemetryInteractObject = {
      id: this.userService.userid,
      type: 'User',
      ver: '1.0'
    };
  }
}
