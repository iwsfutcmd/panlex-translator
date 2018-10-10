import React, { Component } from 'react';

import '@material/button/dist/mdc.button.min.css';
import '@material/card/dist/mdc.card.min.css';
import '@material/dialog/dist/mdc.dialog.min.css';
import {MDCDialog} from '@material/dialog/dist/mdc.dialog.min';
import '@material/fab/dist/mdc.fab.min.css';
import '@material/textfield/dist/mdc.textfield.min.css';
import {MDCTextField} from '@material/textfield/dist/mdc.textfield.min';
import '@material/typography/dist/mdc.typography.min.css';
import '@material/toolbar/dist/mdc.toolbar.min.css';
import '@material/ripple/dist/mdc.ripple.min.css';

import debounce from 'lodash/debounce';
import shuffle from 'lodash/shuffle';
import countBy from 'lodash/countBy';
import orderBy from 'lodash/orderBy';

import './App.css';
import { query, getTranslations, getMultTranslations, getTransPath, getAllTranslations } from './api';
import LvInfo from './LvInfo';
import LvChips from './LvChips';
import LvInput from './LvInput';
import PanLexAppBar from './PanLexAppBar';
import TrnResult from './TrnResult';
import ExprGraph from './ExprGraph';
import './material.css';
import LoadingIcon from './LoadingIcon';


const compactWidth = 840

const DEBUG = true;

const initialUids = [
  'uig-000', 'bre-000', 'oss-000', 'sme-000', 'mhr-000', 'san-000', 'quz-000', 'oci-000', 'nci-000'
];
let u = new URLSearchParams(window.location.search);
const initialInterfaceUid = u.get("lang") || "eng-000";

class App extends Component {
  constructor(props) {
    super(props);
    let labelsToTranslate = [
      'PanLex', 'lng', 'tra', 'al', 'de', 'txt', 'mod', 'npo', 'don', 'plu',
      'trn', 'viz', 'nom', 'kar', 'loc', 'del', 'nno',
    ]
    
    this.state = {
      compact: window.innerWidth <= compactWidth,
      lvCache: new Map(),
      loading: false,
      exprGraphLoading: false,
      direction: 'ltr',
      langDe: {},
      langAl: {},
      langs: [],
      txt: "",
      txtError: false,
      trnTxt: '',
      trnTrn: 0,
      interfaceLangDialogOpen: false,
      interfaceLvTag: "",
      translations: [],
      pathExprs: [],
      exprGraphOpen: false,
      pathDirect: false,
      labels: labelsToTranslate.reduce((obj, v) => {obj[v] = v; return obj;}, {}),
      notFound: false,
    }
  }

  componentWillMount() {
    window.addEventListener('resize', () => this.setState({compact: window.innerWidth <= compactWidth}));
  }

  componentDidMount() {
    this.cacheLvs().then(
      () => this.getInitialLangs(initialUids)).then(
        () => {if (this.state.txt) {
          this.translate();
          this.txtInput.foundation_.activateFocus();
        }
      });
    this.exprGraphDialog = new MDCDialog(document.querySelector('#expr-graph-dialog'));
    this.txtInput = new MDCTextField(document.querySelector('#txt-input-container'));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.setState({windowWidth: window.innerWidth}));
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.interfaceLangvar !== this.state.interfaceLangvar) {
      this.setLabels();
      this.getOtherNames();
      this.cacheKar();
      this.cacheLoc();
      // if (!this.fromLvCache(this.state.interfaceLangvar).IETFTags) {
      //   this.cacheIETFTags(this.state.interfaceLangvar);
      // }
      // let button = document.querySelector('.mdc-button');
      // let ripple = new mdc.ripple.MDCRipple(button);
      // ripple.layout();
      // mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));
    }
    if (prevState.langDe.id && (prevState.langDe.id !== this.state.langDe.id)) {
      localStorage.setItem("langDe", this.state.langDe.id);
      this.setState(
        {langs: [...new Set([prevState.langDe, ...prevState.langs])]},
        () => {this.translate(); this.validateTxt(); this.getOtherNames()}
      )
    }
    if (prevState.langAl.id && (prevState.langAl.id !== this.state.langAl.id)) {
      localStorage.setItem("langAl", this.state.langAl.id);
      this.setState(
        {langs: [...new Set([prevState.langAl, ...prevState.langs])]},
        () => {this.translate(); this.getOtherNames()}
      )
    }
    if (prevState.txt !== this.state.txt) {
      this.validateTxt();
    }
  }

  cacheLvs = () => (
    query('/langvar', {limit: 0, exclude: [
      'grp', 
      'lang_code', 
      'mutable', 
      'name_expr',
      'name_expr_txt_degr',
      'var_code',
     ]}).then(
      r => {
        let lvCache = new Map();
        r.result.forEach(lv => {lvCache.set(lv.id, lv)});
        this.setState({lvCache});
      })
  )
  
  cacheKar = () => (
    getAllTranslations('art-262', this.state.interfaceLangvar, true).then(
      karCache => {
        let lvCache = this.state.lvCache;
        lvCache.forEach(lv => {
          lv.scriptNames = karCache[lv.script_expr].map(r => r.txt);
        })
        this.setState({lvCache});
      }
    )
  )

  cacheLoc = () => {
    let locExprs = [];
    this.state.lvCache.forEach(v => locExprs.push(v.region_expr));
    getMultTranslations(locExprs, '', this.state.interfaceLangvar).then(
      locCache => {
        let lvCache = this.state.lvCache;
        lvCache.forEach(lv => {
          lv.regionNames = locCache[lv.region_expr].map(r => r.txt);
        })
        this.setState({lvCache});
      }
    )
  }

  cacheIETFTags = lvId => (
    lvId && getTranslations(this.fromLvCache(lvId).uid, "art-274", "art-420").then(
      result => {
        let lvCache = this.state.lvCache;
        let lv = lvCache.get(lvId);
        lv.IETFTags = result.sort((a,b) => a.txt.length - b.txt.length).map(t => t.txt);
        lvCache.set(lvId, lv);
        this.setState({lvCache});
      }
    )
  )

  getTag = lvId => {
    let tags = this.fromLvCache(lvId).IETFTags;
    if (!tags) {
      this.cacheIETFTags(lvId);
    }
    return (tags && tags.length) ? tags[0] : "";
  }

  fromLvCache = lvId => (this.state.lvCache.get(lvId) || {})

  getInitialLangs = (initialUids) => {
    let initialUidsSet = new Set(initialUids);
    let urlParams = new URLSearchParams(window.location.search);
    let uidDe = urlParams.get("langDe");
    let uidAl = urlParams.get("langAl");
    let langDe = this.state.lvCache.get(Number(localStorage.getItem("langDe")));
    let langAl = this.state.lvCache.get(Number(localStorage.getItem("langAl")));
    let langs = [];
    let interfaceLv;
    this.state.lvCache.forEach((lv, lvId) => {
      if (initialUidsSet.has(lv.uid)) {
        langs.push(lv);
      }
      if (lv.uid === initialInterfaceUid) {
        interfaceLv = lv;
      }
      if (uidDe && lv.uid === uidDe) {
        langDe = lv;
      }
      if (uidAl && lv.uid === uidAl) {
        langAl = lv;
      }
    })
    this.setState({
      langDe: langDe || interfaceLv,
      langAl: langAl || shuffle(langs)[0],
      langs: shuffle(langs),
      interfaceLangvar: interfaceLv.id,
      txt: urlParams.get("txt") || sessionStorage.getItem("txt") || "",
    });
    // this.getOtherNames(langs.map(lang => lang.id), interfaceLv.id)
  }

  setLabels = () => {
    getMultTranslations(Object.keys(this.state.labels), 'art-000', this.state.interfaceLangvar).then(
      result => {
        let labels = Object.keys(this.state.labels).reduce((obj, label) => {
          if (result[label][0]) {
            obj[label] = result[label][0].txt;
          } else {
            obj[label] = "";
          }
          return(obj)
        }, {})
        this.setState({labels})
      }
    )
  }

  getLabel = (label) => (this.state.labels[label]) ? this.state.labels[label] : label;

  getOtherNames = () => {
    let langs = [this.state.langDe, this.state.langAl, ...this.state.langs]
    getMultTranslations(langs.map(lv => lv.uid), 'art-274', this.state.interfaceLangvar)
      .then(result => {
        let lvCache = this.state.lvCache;
        langs.forEach(lv => {
          let lang = lvCache.get(lv.id);
          lang.otherNames = result[lang.uid].map(r => r.txt);
          lvCache.set(lv, lang);

        })
        this.setState(lvCache);
      })
  }

  validateTxt = debounce(() => {
    sessionStorage.setItem("txt", this.state.txt);
    if (this.state.txt.trim() && this.state.langDe.id) {
      query('/expr/count', {langvar: this.state.langDe.id, txt: this.state.txt.trim()})
        .then((response) => {
          this.setState({txtError: !response.count});
          this.txtInput.valid = !!response.count;
        })
    } else {
      this.setState({txtError: false});
      this.txtInput.valid = true;
    }
    // if (this.state.txt.trim() && this.state.langUnknown) {
    //   query('/expr', {txt: this.state.txt.trim(), include: 'uid'})
    //     .then((response) => {
    //       let foundLangs = response.result.map(r => ({uid: r.uid, name: r.uid}));
    //       this.setState({foundLangs});
    //     })
    // }
  }, 200)

  translate = event => {
    try {
      event.preventDefault();
    } catch (e) {}
    this.setState({loading: true});
    if (this.state.txt.trim() && this.state.langDe.id && this.state.langAl.id) {
      return getTranslations(this.state.txt.trim(), this.state.langDe.id, this.state.langAl.id, this.state.trnTrn)
        .then((result) => {
          let urlParams = new URLSearchParams();
          urlParams.set("langDe", this.state.langDe.uid);
          urlParams.set("langAl", this.state.langAl.uid);
          urlParams.set("txt", this.state.txt.trim());
          let trnTxt = result.length ? result[0].txt : '';
          this.setState({trnTxt, translations: result, loading: false, notFound: !result.length, urlParams});
          window.history.pushState({}, "", "?" + urlParams.toString())
        })
    } else {
      this.setState({loading: false});
    }
  }

  backTranslate = trnIndex => {
    let trn = this.state.translations[trnIndex];
    getTranslations(trn.txt, trn.langvar, trn.trans_langvar)
      .then(result => {
        let translations = this.state.translations;
        translations[trnIndex].backTranslations = result;
        this.setState({translations});
      })
  }

  getDefinitions = trnIndex => {
    let trn = this.state.translations[trnIndex];
    query("/definition", {"expr_txt": trn.txt, "expr_langvar": trn.langvar, "langvar": trn.trans_langvar})
      .then(result => {
        let translations = this.state.translations;
        translations[trnIndex].definitions = result.result.map(d => d.txt);
        this.setState({translations});
      })
  }

  swapLng = (event) => {
    this.setState(prevState => ({
      langDe: prevState.langAl,
      langAl: prevState.langDe,
      txt: prevState.trnTxt}),
      this.translate);
  }

  handleTrnExprClick = trnExprNum => {
    this.setState({exprGraphLoading: true});
    this.exprGraphDialog.show();
    let trn = this.state.translations[trnExprNum]
    getTransPath(trn.trans_expr, trn.id).then(expr => {
      let path;
      if (expr) {
        let pathExprCount = Object.entries(countBy(expr.trans_path.map(p => p[0].expr2)));
        let sortedPathExprs = orderBy(pathExprCount, o => o[1], 'desc');
        let pathExprs = sortedPathExprs.slice(0, 20).map(p => p[0]);
        path = [expr.trans_expr, ...pathExprs, expr.id];
      } else {
        path = [trn.trans_expr, trn.id]
      }
      query('/expr', {trans_expr: path[0], id: path[path.length - 1]}).then(response => {
        let pathDirect = Boolean(response.result.length);
        query('/expr', {id: path, include: 'uid'}).then(response => {
          let exprObj = response.result.reduce((obj, e) => {obj[e.id] = {txt: e.txt, uid: e.uid, langvar: e.langvar}; return(obj)}, {});
          this.setState({pathExprs: path.map(e => exprObj[e]), pathDirect, exprGraphLoading: false});
        })
      })
    });
  }

  handlePathClose = () => {
    this.setState({exprGraphOpen: false})
  }

  handleTouchLvChip = (event, lv) => {
    [].forEach.call(document.getElementsByClassName("droppable"), e => {
      e.classList.add("drop-highlight");
    });
    this.setState({touchedLv: lv});
  }

  handleTouchLangDe = event => {
    console.log(event);
    [].forEach.call(document.getElementsByClassName("droppable"), e => {
      e.classList.remove("drop-highlight");
    });
    let langDe = this.state.lvCache.get(this.state.touchedLv);
    this.setState({langDe, touchedLv: undefined});
  }

  handleTouchLangAl = event => {
    [].forEach.call(document.getElementsByClassName("droppable"), e => {
      e.classList.remove("drop-highlight");
    });
    let langAl = this.state.lvCache.get(this.state.touchedLv);
    this.setState({langAl, touchedLv: undefined});
  }

  clearTxt = () => {
    this.setState({txt: ''});
  }

  render() {
    return (
      <div 
        className="mdc-typography App"
        dir={this.state.direction}
        lang={this.getTag(this.state.interfaceLangvar)}
      >
        <div>
          <PanLexAppBar 
            panlexLabel={this.getLabel('PanLex')}
            title={[this.getLabel('PanLex'), this.getLabel('tra')].join(' — ')}
            lngModLabel={[this.getLabel('lng'), this.getLabel('mod')].join(' — ')}
            donLabel={this.getLabel('don')}
            switchDirection={() => this.setState({direction: (this.state.direction === 'rtl') ? 'ltr' : 'rtl'})}
            setInterfaceLangvar={langvar => {
              this.setState({ 
                interfaceLangvar: langvar,
              });
            }}
            interfaceLangvar={this.state.interfaceLangvar}
            trnLabel={this.getLabel('trn')}
            trnTrnLabel={[this.getLabel('trn'), this.getLabel('trn')].join(' — ')}
            handleTrnTrn={() => this.setState({trnTrn: (this.state.trnTrn + 1) % 3})}
            trnTrn={this.state.trnTrn}
            debug={DEBUG}
          />
          <main className="mdc-toolbar-fixed-adjust">
            <div className="trn">
              <div className="trn-box">
                <div
                  onDrop={event => {
                    event.preventDefault();
                    let langDe = this.state.lvCache.get(parseInt(event.dataTransfer.getData("text"), 10));
                    if (langDe) {this.setState({langDe})}
                  }}
                  onDragOver={event => {event.preventDefault()}}
                >
                  <div className="uid-box">
                    <div className="uid-box-button">
                      <LvInput
                        label={[this.getLabel('lng'), this.getLabel('de')].join(' — ')}
                        interfaceLangvar={this.state.interfaceLangvar}                        
                        onNewRequest={lv => {
                          let langDe = this.state.lvCache.get(lv);
                          this.setState({langDe});
                        }}
                      />
                      <button 
                        className="mdc-fab mdc-fab--mini material-icons"
                        onClick={this.swapLng}
                      >
                        <span className="mdc-fab__icon" id="swap-icon">
                          {this.state.compact ? "swap_vert" : "swap_horiz"}
                        </span>
                      </button>
                    </div>
                    <LvInfo 
                      nomLabel={this.getLabel('nom') + " — " + this.fromLvCache(this.state.interfaceLangvar).name_expr_txt + ":"}
                      karLabel={this.getLabel('kar') + ":"}
                      locLabel={this.getLabel('loc') + ":"}
                      lang={this.state.langDe}
                      onTouchStart={this.state.touchedLv && this.handleTouchLangDe}
                    />
                  </div>
                  <div className="trn-card mdc-card">
                    <section className="txt-input">
                      <form id="trn-txt">
                        <div id="txt-input-container" className="mdc-text-field mdc-text-field--with-trailing-icon">
                          <input 
                            id="txt-input"
                            className="mdc-text-field__input"
                            type="text"
                            onChange={event => {this.setState({txt: event.target.value})}}
                            value={this.state.txt}
                            lang={this.getTag(this.state.langDe.id)}
                            autoCapitalize="none"
                          />
                          <label className="mdc-text-field__label" htmlFor="txt-input">
                            {this.getLabel('txt')}
                          </label>
                          <i 
                            className="material-icons mdc-text-field__icon" 
                            alt={this.getLabel('del')}
                            tabIndex="0"
                            onClick={() => {this.setState({txt: ''})}}                                
                          >
                            clear
                          </i>
                          <div className="mdc-line-ripple"/>
                        </div>
                        <p className="mdc-text-field-helper-text mdc-text-field-helper-text--validation-msg">
                          {this.getLabel('npo')}
                        </p>
                      </form>
                    </section>
                  </div>
                </div>
                <LvChips
                  langList={this.state.langs}
                  onTouchStart={this.handleTouchLvChip}
                />
              </div>
              <div
                className="trn-box"
                onDrop={event => {
                  event.preventDefault();
                  let langAl = this.state.lvCache.get(parseInt(event.dataTransfer.getData("text"), 10));
                  if (langAl) {this.setState({langAl})}
                }}
                onDragOver={event => {event.preventDefault()}}
              >
                <div className="uid-box">
                  <div className="uid-box-button">
                    <LvInput
                      label={[this.getLabel('lng'), this.getLabel('al')].join(' — ')}
                      interfaceLangvar={this.state.interfaceLangvar}                        
                      onNewRequest={lv => {
                        let langAl = this.state.lvCache.get(lv);
                        this.setState({langAl});
                      }}
                    />
                    <button 
                      onClick={this.translate}
                      type="submit"
                      className="tra-button mdc-button mdc-button--raised"
                      form="trn-txt"
                    >
                      {this.getLabel('tra')}
                    </button>
                  </div>
                  <LvInfo 
                    nomLabel={this.getLabel('nom') + " — " + this.fromLvCache(this.state.interfaceLangvar).name_expr_txt + ":"}
                    karLabel={this.getLabel('kar') + ":"}
                    locLabel={this.getLabel('loc') + ":"}
                    lang={this.state.langAl}
                    onTouchStart={this.state.touchedLv && this.handleTouchLangAl}
                  />
                </div>
                <div className="trn-card mdc-card">
                  <section className="card-title">
                    {this.state.notFound ? 
                      <span className="mdc-typography--caption" id="nno-label">{this.getLabel('nno')}</span> :
                      <span lang={this.getTag(this.state.langAl.id)} id="first-trn-txt" tabIndex="0">
                        {this.state.trnTxt}
                      </span>
                    }
                    {this.state.loading ? <LoadingIcon/> : ''}
                  </section>
                  <TrnResult
                    translations={this.state.translations}
                    onExprClick={this.handleTrnExprClick}
                    onTrnToggle={this.backTranslate}
                    onDefClick={this.getDefinitions}
                    graphButtonAlt={[this.getLabel('trn'), this.getLabel('viz')].join(' — ')}
                    tagDe={this.getTag(this.state.langDe.id)}
                    tagAl={this.getTag(this.state.langAl.id)}
                  />
                </div>
              </div>
            </div>
          </main>
          <aside
            id="expr-graph-dialog" 
            className="mdc-dialog" 
            role="alertdialog">
            <div id="expr-graph-dialog-surface" className="mdc-dialog__surface">
              <section className="mdc-dialog__body">
                <button className="material-icons close-button mdc-dialog__footer__button--accept">close</button>
                {this.state.exprGraphLoading ? 
                  <LoadingIcon size={64}/> :
                  <ExprGraph pathExprs={this.state.pathExprs} pathDirect={this.state.pathDirect} lvCache={this.state.lvCache}/>
                }
              </section>
            </div>
            <div className="mdc-dialog__backdrop"></div>
          </aside>
        </div>
      </div>
    );
  }
}

export default App;
