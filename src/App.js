import React, { Component } from 'react';

import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import AppBar from 'material-ui/AppBar';
import CircularProgress from 'material-ui/CircularProgress';
import IconMenu from 'material-ui/IconMenu';
import IconButton from 'material-ui/IconButton';
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert';
import MenuItem from 'material-ui/MenuItem';
import SvgIcon from 'material-ui/SvgIcon';
import injectTapEventPlugin from 'react-tap-event-plugin';

import './App.css';
import logo from './logo.svg';
import { getTranslations } from './api';
import UidInput from './UidInput';
import TrnResult from './TrnResult';

const panlexRed = '#A60A0A';
injectTapEventPlugin();

const DEBUG = false;

class App extends Component {
  constructor(props) {
    super(props);
    const muiTheme = getMuiTheme({
      palette: {
        primary1Color: panlexRed,
      }
    })
    let labelsToTranslate = ['PanLex', 'lng', 'tra', 'al', 'de', 'txt', 'mod']
    
    this.state = {
      muiTheme,
      loading: false,
      direction: 'ltr',
      uidDe: '',
      uidAl: '',
      txt: '',
      interfaceLang: 'eng-000',
      translations: [],
      labels: labelsToTranslate.reduce((obj, v) => {obj[v] = v; return obj;}, {}),
    }
    this.setLabels();
  }

  setLabels = () => {
    getTranslations(Object.keys(this.state.labels), 'art-000', this.state.interfaceLang)
    .then((result) => {
      let output = {};
      for (let txt of Object.keys(this.state.labels)) {
        try {
          output[txt] = result.filter(trn => (trn.trans_txt === txt))[0].txt;
        } catch (e) {
          output[txt] = txt;
        }
      };
      this.setState({labels: output, interfaceLangvar: result[0].langvar});
    });
  };

  getLabel = (label) => (this.state.labels[label]) ? this.state.labels[label] : label;

  translate = (event) => {
    event.preventDefault();
    this.setState({loading: true})
    getTranslations(this.state.txt.trim(), this.state.uidDe, this.state.uidAl)
    .then((result) => this.setState({translations: result, loading: false}));
  }

  render() {
    let originHorizontal = (this.state.direction === 'rtl') ? "left" : "right";
    this.state.muiTheme.isRtl = (this.state.direction === 'rtl');
    return (
      <div className="App" style={{direction: this.state.direction}}>
        <MuiThemeProvider muiTheme={this.state.muiTheme}>
          <div>
            <AppBar
              title={[this.getLabel('PanLex'), this.getLabel('tra')].join(' — ')}
              iconElementRight={DEBUG && 
                <IconMenu 
                  iconButtonElement={<IconButton><MoreVertIcon /></IconButton>}
                  anchorOrigin={{horizontal: originHorizontal, vertical: 'top'}}
                  targetOrigin={{horizontal: originHorizontal, vertical: 'top'}}
                >
                  <MenuItem
                    primaryText="🔁"
                    onClick={() => this.setState({direction: (this.state.direction === 'rtl') ? 'ltr' : 'rtl'})}
                  />
                  {/* <MenuItem>
                    <UidInput
                      onNewRequest={(item) => {
                    this.setState({ interfaceLang: item.text });
                    this.setLabels();
                      }}
                      direction={this.state.direction}
                      label={[this.getLabel('lng'), this.getLabel('mod')].join(' — ')}
                      interfaceLangvar={this.state.interfaceLangvar}
                    />
                  </MenuItem> */}
                </IconMenu>
              }
              iconStyleRight={{margin: "8px -16px"}}
              // iconElementLeft={<img src={logo} className="App-logo" alt="logo" />}
              showMenuIconButton={false}
            />
            {DEBUG && [
              <RaisedButton
                label="🔁"
                onClick={() => this.setState({direction: (this.state.direction === 'rtl') ? 'ltr' : 'rtl'})}
              />,
              <UidInput
                onNewRequest={(item) => {
                  this.setState({ interfaceLang: item.text });
                  this.setLabels();
                }}
                direction={this.state.direction}
                label={[this.getLabel('lng'), this.getLabel('mod')].join(' — ')}
                interfaceLangvar={this.state.interfaceLangvar}
              />]
            }
            <div className="langvar-select">
              <UidInput
                onNewRequest={(item) => this.setState({ uidDe: item.text })}
                direction={this.state.direction}
                label={[this.getLabel('lng'), this.getLabel('de')].join(' — ')}
                interfaceLangvar={this.state.interfaceLangvar}
                style={{flex: 1}}
              />
              <UidInput
                onNewRequest={(item) => this.setState({ uidAl: item.text })}
                direction={this.state.direction}
                label={[this.getLabel('lng'), this.getLabel('al')].join(' — ')}
                interfaceLangvar={this.state.interfaceLangvar}
                style={{flex: 0}}
              />
            </div>
            <form>
              <TextField
                floatingLabelText={this.getLabel('txt')}
                floatingLabelStyle={{transformOrigin: (this.state.direction === 'rtl') ? "right top 0px" : "left top 0px"}}
                fullWidth={true}
                onChange={(event, txt) => this.setState({txt})}
              />
              <RaisedButton
                type="submit"
                label={this.getLabel('tra')}
                primary={true}
                onClick={this.translate}
              />
            </form>
            <div className="result">
              {(this.state.loading) ?
                <div><CircularProgress/></div> :
                <TrnResult
                  muiTheme={this.state.muiTheme}
                  direction={this.state.direction}
                  translations={this.state.translations}/>
              }
            </div>
          </div>
        </MuiThemeProvider>
      </div>
    );
  }
}

export default App;
