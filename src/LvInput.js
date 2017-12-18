import React, { Component } from 'react';

import '@material/list/dist/mdc.list.min.css';
import '@material/menu/dist/mdc.menu.min.css';
import {MDCSimpleMenu} from '@material/menu/dist/mdc.menu.min';
import '@material/textfield/dist/mdc.textfield.min.css';
import {MDCTextField} from '@material/textfield/dist/mdc.textfield.min';

import debounce from 'lodash/debounce';
import { query } from './api';
import './LvInput.css';
import LoadingIcon from './LoadingIcon';

export default class UidInput extends Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      suggestions: [],
      loading: false,
    }
  }
  
  renderSuggestion = s => (
    <li className="mdc-list-item" role="menuitem" onClick={
      () => {
        this.setState({searchText: ''}); 
        this.props.onNewRequest(s.id);
      }} 
      key={s.id}> 
      <div className='lv-item' dir={this.props.direction}>
        <div className='lv-line lv-main-line'>
          <span className='lv-name'>{s.trans[0].txt}</span>
          <span>{s.uid}</span>
        </div>
        <div className='lv-line lv-alt-line'>
          {s.trans.slice(1).map(tran => tran.txt).join(' — ')}
        </div>
      </div>
    </li>
  );

  getSuggestions = debounce((txt) => {
    if (txt) {
      this.setState({loading: true});
      query('/suggest/langvar', {'txt': txt, 'pref_trans_langvar': this.props.interfaceLangvar})
      .then((response) => {
        this.setState({loading: false});
        if (response.suggest) {
          let suggestions = response.suggest;
          this.setState({ suggestions }, () => {this.suggestMenu.open = true});
        } else {
          this.setState({ suggestions: []});
        }
      });
    } else {
      this.setState({ suggestions: []});
    }
  }, 500);
  
  onChange = event => {
    this.setState({searchText: event.target.value});
    this.getSuggestions(event.target.value);
  }

  render() {
    return (
      <span>
        <span className="lv-input-container" style={this.props.style} dir={this.props.direction}>
          {this.state.loading && <div className="loading"><LoadingIcon/></div>}
          <div 
            ref={div => {if (div) {this.lvInput = new MDCTextField(div)}}}
            className="mdc-text-field mdc-text-field--upgraded"
          >
            <input 
              id="lv-input"
              className="mdc-text-field__input"
              type="text"
              value={this.state.searchText}
              onChange={this.onChange}
            />
            <label className="mdc-text-field__label" htmlFor="lv-input">{this.props.label}</label>
            <div className="mdc-text-field__bottom-line"/>
          </div>
        </span>
        <div className="mdc-menu-anchor">
          <div 
            ref={div => {if (div) {this.suggestMenu = new MDCSimpleMenu(div)}}}
            id="suggest-menu"
            className="mdc-simple-menu"
          >
            <ul className="mdc-simple-menu__items mdc-list" role="menu">
              {this.state.suggestions.map(s => this.renderSuggestion(s))}
            </ul>
          </div>
        </div>
      </span>
    )
  }
}