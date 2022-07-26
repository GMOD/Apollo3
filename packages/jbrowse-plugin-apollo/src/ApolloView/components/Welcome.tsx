import WarningIcon from '@mui/icons-material/Warning'
import {
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  IconButton,
  SvgIcon,
  SvgIconProps,
  Typography,
} from '@mui/material'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

interface WelcomeProps {
  setEditorType(type?: 'local' | 'collaboration'): void
}

function FileDocumentEditIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H10V20.09L12.09,18H6V16H14.09L16.09,14H6V12H18.09L20,10.09V8L14,2H6M13,3.5L18.5,9H13V3.5M20.15,13C20,13 19.86,13.05 19.75,13.16L18.73,14.18L20.82,16.26L21.84,15.25C22.05,15.03 22.05,14.67 21.84,14.46L20.54,13.16C20.43,13.05 20.29,13 20.15,13M18.14,14.77L12,20.92V23H14.08L20.23,16.85L18.14,14.77Z" />
    </SvgIcon>
  )
}

function AccountGroupIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z" />
    </SvgIcon>
  )
}

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    background: theme.palette.background.default,
  },
  logo: {
    width: 100,
  },
  card: {
    margin: theme.spacing(2),
    width: 150,
  },
  cardMedia: {
    background: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
  },
  cardMediaDisabled: {
    background: theme.palette.primary.light,
  },
  cardIcon: {
    fontSize: 100,
    color: theme.palette.primary.contrastText,
  },
}))

function Welcome({ setEditorType }: WelcomeProps) {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      <img
        src="http://localhost:9000/WebApolloLogoA.png"
        alt="Logo"
        className={classes.logo}
      />
      <Typography variant="h2">Apollo</Typography>
      <div style={{ display: 'flex' }}>
        <Card className={classes.card}>
          <CardActionArea disabled>
            <div className={clsx(classes.cardMedia, classes.cardMediaDisabled)}>
              <FileDocumentEditIcon className={classes.cardIcon} />
            </div>
            <CardContent>
              <Typography variant="h5" component="h2">
                Local
              </Typography>
              <Typography variant="body2" component="p">
                Open a local file for editing
              </Typography>
            </CardContent>
          </CardActionArea>
          <CardActions>
            <IconButton disabled>
              <WarningIcon />
            </IconButton>
            <Typography variant="body2" component="p" color="textSecondary">
              This feature is not yet available
            </Typography>
          </CardActions>
        </Card>
        <Card
          className={classes.card}
          onClick={() => {
            setEditorType('collaboration')
          }}
        >
          <CardActionArea>
            <div className={classes.cardMedia}>
              <AccountGroupIcon className={classes.cardIcon} />
            </div>
            <CardContent>
              <Typography variant="h5" component="h2">
                Collaborative
              </Typography>
              <Typography variant="body2" component="p">
                Connect to an Apollo Collaboration Server
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </div>
    </div>
  )
}

const WelcomeObserved = observer(Welcome)

export { WelcomeObserved as Welcome }
