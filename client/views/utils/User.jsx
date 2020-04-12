import React from 'react';
import PropTypes from 'prop-types'
import cn from 'classnames'
import {connect} from 'react-redux';

import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Tooltip from "@material-ui/core/Tooltip/Tooltip";
import T from "i18n-react";

import IconButton from "@material-ui/core/IconButton";
import IconKickUser from '@material-ui/icons/Clear';
import IconBanUser from '@material-ui/icons/Block';
import Typography from "@material-ui/core/Typography";

const defaultUser = (id) => ({
  id, login: '---'
});

const cnUser = (user, className = '') => cn(
  'User'
  , className
  , {auth: user.authType}
);

export const UserVariants = {
  simple: ({user, login, className}) => <span className={cnUser(user, className)}>{login || user.login}</span>
  , typography: ({user, login, className}) => (
    <Typography display='inline'
                className={cnUser(user, className)}
                color='inherit'
                component='span'>
      {login || user.login}
    </Typography>
  )
  , listItem: ({user, login, actions}) => (
    <ListItem key={user.id} className={cnUser(user)} style={{width: 'auto'}}>
      <ListItemText primary={login || user.login}/>
      {!!actions ? actions : null}
    </ListItem>
  )
  , listItemWithActions: ({user, userId, isHost, roomKickRequest, roomBanRequest}) => (
    <UserVariants.listItem user={user} actions={
      user.id !== userId && isHost && <ListItemSecondaryAction>
        <Tooltip title={T.translate('App.Room.$Kick')}>
          <IconButton onClick={() => roomKickRequest(user.id)}><IconKickUser/></IconButton>
        </Tooltip>
        <Tooltip title={T.translate('App.Room.$Ban')}>
          <IconButton onClick={() => roomBanRequest(user.id)}><IconBanUser/></IconButton>
        </Tooltip>
      </ListItemSecondaryAction>}
    />
  )
};

export const UserConnected = connect(
  (state, {id}) => ({
    id
    , user: state.getIn(['online', id], defaultUser(id))
  })
)(({children, variant, ...props}) => children ? children(props) : UserVariants[variant](props));

UserConnected.propTypes = {
  id: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['simple', 'typography', 'listItem', 'listItemWithActions'])
};
UserConnected.defaultProps = {
  variant: 'typography'
};

export default UserConnected;