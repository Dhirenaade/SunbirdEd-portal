import { Component, OnInit, Output, Input, EventEmitter, OnChanges, AfterViewInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { McqForm } from './../../class/McqForm';
import { ConfigService, IUserData, IUserProfile, ToasterService } from '@sunbird/shared';
import { UserService, ActionService } from '@sunbird/core';
import { TelemetryService } from '@sunbird/telemetry';
import * as _ from 'lodash-es';
import { UUID } from 'angular2-uuid';
import { HttpClientModule } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CbseProgramService } from '../../services';

@Component({
  selector: 'app-mcq-creation',
  templateUrl: './mcq-creation.component.html',
  styleUrls: ['./mcq-creation.component.scss']
})
export class McqCreationComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() sessionContext: any;
  @Input() questionMetaData: any;
  @Output() questionStatus = new EventEmitter<any>();
  @Output() questionQueueStatus = new EventEmitter<any>();
  @Input() questionSelectionStatus: any;
  @Input() role: any;
  @ViewChild('mcqFormControl') private mcqFormControl;
  @ViewChild('author_names') authorName;
  public userProfile: IUserProfile;
  showTemplatePopup = false;
  showForm = false;
  templateDetails: any = {};
  initEditor = false;
  mcqForm: McqForm;
  body: any;
  optionBody: any = [];
  isEditorThrowingError: boolean;
  showFormError = false;
  isReadOnlyMode = false;
  public showPreview = false;
  public previewData: any;
  public setCharacterLimit = 160;
  public setImageLimit = 1;
  public refresh = true;
  public mediaArr = [];
  public rejectComment: any;
  public userName: any;
  learningOutcomeOptions = [];
  updateStatus = 'update';
  bloomsLevelOptions = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];
  constructor(public configService: ConfigService, private http: HttpClient,
    private userService: UserService, public actionService: ActionService,
    public toasterService: ToasterService, private cdr: ChangeDetectorRef, private cbseService: CbseProgramService,
    public telemetryService: TelemetryService) {
  }
  initForm() {
    if (this.questionMetaData && this.questionMetaData.data) {
      const { question, responseDeclaration, templateId, learningOutcome, bloomsLevel } = this.questionMetaData.data;
      const options = _.map(this.questionMetaData.data.options, option => ({ body: option.value.body }));
      this.mcqForm = new McqForm({
        question, options, answer: _.get(responseDeclaration, 'responseValue.correct_response.value'),
        learningOutcome: (learningOutcome && learningOutcome[0] || ''),
        bloomsLevel: (bloomsLevel && bloomsLevel[0] || '')
      }, { templateId });
      if (this.questionMetaData.data.media) {
        this.mediaArr = this.questionMetaData.data.media;
      }
    } else {
      this.mcqForm = new McqForm({ question: '', options: [] }, {});
    }
    this.showForm = true;
  }
  ngOnInit() {
    if (this.sessionContext.bloomsLevel) {
      this.bloomsLevelOptions = this.sessionContext.bloomsLevel;
    }
    const topicTerm = _.find(this.sessionContext.topicList, { name: this.sessionContext.topic });
    if (topicTerm && topicTerm.associations) {
      this.learningOutcomeOptions = topicTerm.associations;
    }
    if (this.role.currentRole === 'REVIEWER' || this.role.currentRole === 'PUBLISHER') {
      this.showPreview = true;
      // this.buttonTypeHandler('preview');
    }
    this.userName = this.setUserName();
    this.isReadOnlyMode = this.sessionContext.isReadOnlyMode;
  }
  ngAfterViewInit() {
    if (this.isReadOnlyMode) {
      const windowData: any = window;
      const el = document.getElementsByClassName('ckeditor-tool__solution__body');
      // tslint:disable-next-line:only-arrow-functions
      for (let i = 0; i < el.length; i++) {
        windowData.com.wiris.js.JsPluginViewer.parseElement(el[i], true, () => {});
      }
    }
  }
  ngOnChanges() {
    this.previewData = this.questionMetaData;
    if (this.role.currentRole === 'REVIEWER' || this.role.currentRole === 'PUBLISHER') {
      this.showPreview = true;
    } else if ((this.sessionContext.role === 'CONTRIBUTOR') && (this.sessionContext.showMode = 'editorForm')) {
      this.showPreview = false;
    }
    if (this.questionMetaData && this.questionMetaData.mode === 'edit' && this.questionMetaData.data.status === 'Reject' &&
      this.questionMetaData.data.rejectComment) {
      this.rejectComment = this.questionMetaData.data.rejectComment;
    }
    if (this.questionMetaData && this.questionMetaData.mode === 'create') {
      this.showTemplatePopup = true;
    } else {
      this.initForm();
    }
  }

  handleTemplateSelection(event) {

    this.showTemplatePopup = false;
    if (event.type === 'submit') {
      this.templateDetails = event.template;
      this.initForm();
    } else {
      this.questionStatus.emit({ type: 'close' });
    }
  }
  handleQuestionSelectionStatus(event) {
    this.questionQueueStatus.emit(event);
  }
  setUserName() {
    let userName = '';
    if (this.userService.userProfile.firstName) {
      userName = this.userService.userProfile.firstName;
    }
    if (this.userService.userProfile.lastName) {
      userName += (' ' + this.userService.userProfile.lastName);
    }
    return userName;
  }

  handleReviewrStatus(event) {
    this.updateQuestion([{ key: 'status', value: event.status }, { key: 'rejectComment', value: event.rejectComment }]);
  }
  handleSubmit(formControl) {
    const optionValid = _.find(this.mcqForm.options, option =>
      (option.body === undefined || option.body === '' || option.length > this.setCharacterLimit));
    if (formControl.invalid || optionValid || !this.mcqForm.answer || [undefined, ''].includes(this.mcqForm.question)) {
      this.showFormError = true;
      return;
    }
    if (this.questionMetaData.mode === 'create') {
      this.createQuestion();
    } else {
      this.updateQuestion();
    }
  }
  handleEditorError(event) {
    this.isEditorThrowingError = event;
  }
  buttonTypeHandler(event) {
    if (event === 'preview') {
      this.sessionContext.showMode = 'previewPlayer';
      // this.showPreview = true;
      // call createQuestion with param true to get the local question data
      if (this.sessionContext.currentRole === 'CONTRIBUTOR') {
        this.createQuestion(true);
      }
    } else if (event === 'edit') {
      this.sessionContext.showMode = 'editorForm';
      this.refreshEditor();
      this.showPreview = false;
    } else {
      this.handleSubmit(this.mcqFormControl);
    }
  }
  getConvertedLatex(body) {
    const getLatex = (encodedMath) => {
      return this.http.get('https://www.wiris.net/demo/editor/mathml2latex?mml=' + encodedMath, {
        responseType: 'text'
      });
    };
    let latexBody;
    const isMathML = body.match(/((<math("[^"]*"|[^\/">])*)(.*?)<\/math>)/gi);
    if (isMathML && isMathML.length > 0) {
      latexBody = isMathML.map(math => {
        const encodedMath = encodeURIComponent(math);
        return getLatex(encodedMath);
      });
    }
    if (latexBody) {
      return forkJoin(latexBody).pipe(
        map((res) => {
          _.forEach(res, (latex, i) => {
            body = latex.includes('Error') ? body : body.replace(isMathML[i], '<span class="mathText">' + latex + '</span>');
          });
          return body;
        })
      );
    } else {
      return of(body);
    }
  }
  getConvertedSVG(body) {
    const getLatex = (encodedMath) => {
      return this.http.get('https://www.wiris.net/demo/editor/render?mml=' + encodedMath + '&backgroundColor=%23fff&format=svg', {
        responseType: 'text'
      });
    };
    let latexBody;
    const isMathML = body.match(/((<math("[^"]*"|[^\/">])*)(.*?)<\/math>)/gi);
    if (isMathML && isMathML.length > 0) {
      latexBody = isMathML.map(math => {
        const encodedMath = encodeURIComponent(math);
        return getLatex(encodedMath);
      });
    }
    if (latexBody) {
      return forkJoin(latexBody).pipe(
        map((res) => {
          _.forEach(res, (latex, i) => {
            body = latex.includes('Error') ? body : body.replace(isMathML[i], latex);
          });
          return body;
        })
      );
    } else {
      return of(body);
    }
  }
  /**
   * @param optionalParams  {Array of Objects }  -Key and Value to add in metadata
   */
  updateQuestion(optionalParams?: Array<{}>) {
    forkJoin([this.getConvertedLatex(this.mcqForm.question), ...this.mcqForm.options.map(option => this.getConvertedLatex(option.body))])
      .subscribe((res) => {
        this.body = res[0]; // question with latex
        this.optionBody = res.slice(1).map((option, i) => { // options with latex
          return { body: res[i + 1] };
        });


        const questionData = this.getHtml(this.body, this.optionBody);
        const correct_answer = this.mcqForm.answer;
        const options = _.map(this.mcqForm.options, (opt, key) => {
          if (Number(correct_answer) === key) {
            return { 'answer': true, value: { 'type': 'text', 'body': opt.body } };
          } else {
            return { 'answer': false, value: { 'type': 'text', 'body': opt.body } };
          }
        });

        const metadata = {
          'code': UUID.UUID(),
          'category': this.sessionContext.questionType.toUpperCase(),
          'templateId': this.questionMetaData.data.templateId,
          'name': this.sessionContext.questionType + '_' + this.sessionContext.framework,
          'body': questionData.body,
          'responseDeclaration': questionData.responseDeclaration,
          'question': this.mcqForm.question,
          'options': options,
          // 'qlevel': this.mcqForm.difficultyLevel,
          'maxScore': 1, // Number(this.mcqForm.maxScore),
          'status': 'Review',
          'media': this.mediaArr,
          'type': 'mcq',
        };

        if (this.sessionContext.currentRole === 'CONTRIBUTOR') {
          const authorName = (this.authorName.nativeElement.value === '') ? this.userName : this.authorName.nativeElement.value;
          metadata['author'] = authorName;
        }

        if (this.mcqForm.learningOutcome) {
          metadata['learningOutcome'] = [this.mcqForm.learningOutcome];
        }

        if (this.mcqForm.bloomsLevel) {
          metadata['bloomsLevel'] = [this.mcqForm.bloomsLevel];
        }


        const req = {
          url: this.configService.urlConFig.URLS.ASSESSMENT.UPDATE + '/' + this.questionMetaData.data.identifier,
          data: {
            'request': {
              'assessment_item': {
                'objectType': 'AssessmentItem',
                'metadata': metadata
              }
            }
          }
        };
        if (optionalParams) {
          _.forEach(optionalParams, (param) => {
            req.data.request.assessment_item.metadata[param.key] = param.value;
            if (param.key === 'status') {
              this.updateStatus = param.value;
            }
          });
        }
        this.actionService.patch(req).pipe(catchError(err => {
          const errInfo = { errorMsg: 'MCQ Question updation failed' };
          return throwError(this.cbseService.apiErrorHandling(err, errInfo));
        })).subscribe((apiRes) => {
          if (this.updateStatus === 'Live') {
            this.toasterService.success('Question Accepted');
          } else if (this.updateStatus === 'Reject') {
            this.toasterService.success('Question Rejected');
          }
          this.questionStatus.emit({ 'status': 'success', 'type': this.updateStatus, 'identifier': apiRes.result.node_id });
        });
      });
  }
  /**
   * - If it is a local preview don't create question.
   * - for local preview only question body required with all other parameter to create Ecml.
   */
  createQuestion(forPreview?: boolean) {
    forkJoin([this.getConvertedLatex(this.mcqForm.question), ...this.mcqForm.options.map(option => this.getConvertedLatex(option.body))])
      .subscribe((res) => {
        this.body = res[0]; // question with latex
        this.optionBody = res.slice(1).map((option, i) => { // options with latex
          return { body: res[i + 1] };
        });
        console.log(this.mcqForm);
        const questionData = this.getHtml(this.body, this.optionBody);
        const correct_answer = this.mcqForm.answer;
        const options = _.map(this.mcqForm.options, (opt, key) => {
          if (Number(correct_answer) === key) {
            return { 'answer': true, value: { 'type': 'text', 'body': opt.body } };
          } else {
            return { 'answer': false, value: { 'type': 'text', 'body': opt.body } };
          }
        });
        let creator = this.userService.userProfile.firstName;
        let authorName;
        if (!_.isEmpty(this.userService.userProfile.lastName)) {
          creator = this.userService.userProfile.firstName + ' ' + this.userService.userProfile.lastName;
        }
        if (this.role.currentRole === 'CONTRIBUTOR' && !this.showPreview) {
          authorName = (this.authorName.nativeElement.value === '') ? this.userName : this.authorName.nativeElement.value;
        }
        const metadata = {
          'createdBy': this.userService.userid,
          'creator': creator,
          'organisation': this.sessionContext.onBoardSchool ? [this.sessionContext.onBoardSchool] : [],
          'code': UUID.UUID(),
          'type': this.sessionContext.questionType,
          'category': this.sessionContext.questionType.toUpperCase(),
          'itemType': 'UNIT',
          'version': 3,
          'name': this.sessionContext.questionType + '_' + this.sessionContext.framework,
          'body': questionData.body,
          'responseDeclaration': questionData.responseDeclaration,
          'question': this.mcqForm.question,
          'options': options,
          // 'qlevel': this.mcqForm.difficultyLevel,
          'maxScore': 1, // Number(this.mcqForm.maxScore),
          'templateId': this.templateDetails.templateClass,
          'programId': this.sessionContext.programId,
          'program': this.sessionContext.program,
          'channel': this.sessionContext.channel,
          'framework': this.sessionContext.framework,
          'board': this.sessionContext.board,
          'medium': this.sessionContext.medium,
          'gradeLevel': [this.sessionContext.gradeLevel],
          'subject': this.sessionContext.subject,
          'topic': [this.sessionContext.topic],
          'status': 'Review',
          'media': this.mediaArr,
          'qumlVersion': 0.5,
          'textBookUnitIdentifier': this.sessionContext.textBookUnitIdentifier,
          'author': authorName
        };

        if (this.mcqForm.learningOutcome) {
          metadata['learningOutcome'] = [this.mcqForm.learningOutcome];
        }

        if (this.mcqForm.bloomsLevel) {
          metadata['bloomsLevel'] = [this.mcqForm.bloomsLevel];
        }
        const req = {
          url: this.configService.urlConFig.URLS.ASSESSMENT.CREATE,
          data: {
            'request': {
              'assessment_item': {
                'objectType': 'AssessmentItem',
                'metadata': metadata
              }
            }
          }
        };
        // Don't make any api call for a local preview.
        if (!forPreview) {
          this.actionService.post(req).pipe(catchError(err => {
            const errInfo = { errorMsg: 'MCQ Question creation failed' };
            return throwError(this.cbseService.apiErrorHandling(err, errInfo));
          })).subscribe((apiRes) => {
            this.questionStatus.emit({ 'status': 'success', 'type': 'create', 'identifier': apiRes.result.node_id });
          });
        } else {
          this.sessionContext.previewQuestionData = {
            result: {
              assessment_item: req.data.request.assessment_item.metadata
            }
          };
          // Initialize preview player, Once all the data is attacthed
          this.showPreview = true;
        }
      });
  }

  getHtml(question, options) {
    const { mcqBody, optionTemplate } = this.configService.editorConfig.QUESTION_EDITOR;
    const optionsBody = _.map(options, data => optionTemplate.replace('{option}', data.body)) // passion option which has latex
      .map((data, index) => data.replace('{value}', index)).join('');
    let templateClass;
    if (this.questionMetaData.mode === 'create') {
      templateClass = this.templateDetails.templateClass;
    } else {
      templateClass = this.questionMetaData.data.templateId; // TODO: need to be verified
    }
    const questionBody = mcqBody.replace('{templateClass}', templateClass)
      .replace('{question}', question).replace('{optionList}', optionsBody); // passion question which has latex
    const responseDeclaration = {
      responseValue: {
        cardinality: 'single',
        type: 'integer',
        'correct_response': {
          value: this.mcqForm.answer
        }
      }
    };
    return {
      body: questionBody,
      responseDeclaration: responseDeclaration,
      correct_response: parseInt(this.mcqForm.answer, 10) + 1,
      // tslint:disable-next-line:max-line-length
      learningOutcome: (this.questionMetaData.data && this.questionMetaData.data.learningOutcome) ? this.questionMetaData.data.learningOutcome[0] : '',
      learningLevel: this.mcqForm.bloomsLevel || ''
    };
  }

  getMedia(media) {
    if (media) {
      const value = _.find(this.mediaArr, ob => {
        return ob.id === media.id;
      });
      if (value === undefined) {
        this.mediaArr.push(media);
      }
    }
  }
  private refreshEditor() {
    this.refresh = false;
    this.cdr.detectChanges();
    this.refresh = true;
  }
}
