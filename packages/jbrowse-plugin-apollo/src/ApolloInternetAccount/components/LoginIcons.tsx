import { SvgIcon, type SvgIconProps } from '@mui/material'
import React from 'react'

// Icon source: https://developers.google.com/identity/branding-guidelines
export function Google(props: SvgIconProps) {
  const { color } = props
  return (
    <SvgIcon
      viewBox="0 0 18 18"
      style={{ fontSize: 18, marginRight: 4 }}
      {...props}
    >
      {color === 'disabled' ? (
        <path d="M9.001,10.71 l0,-3.348 l8.424,0 c0.126,0.567,0.225,1.098,0.225,1.845 c0,5.139,-3.447,8.793,-8.64,8.793 c-4.968,0,-9,-4.032,-9,-9 c0,-4.968,4.032,-9,9,-9 c2.43,0,4.464,0.891,6.021,2.349 l-2.556,2.484 c-0.648,-0.612,-1.782,-1.332,-3.465,-1.332 c-2.979,0,-5.409,2.475,-5.409,5.508 c0,3.033,2.43,5.508,5.409,5.508 c3.447,0,4.716,-2.385,4.95,-3.798 l-4.959,0 l0,-0.009 z"></path>
      ) : (
        <>
          <path
            d="M17.64,9.20454545 c0,-0.638,-0.057,-1.252,-0.164,-1.841 l-8.476,0 l0,3.481 l4.844,0 c-0.209,1.125,-0.843,2.079,-1.796,2.717 l0,2.258 l2.908,0 c1.702,-1.567,2.684,-3.874,2.684,-6.615 l0,0 z"
            fill="#4285F4"
          ></path>
          <path
            d="M9,18 c2.43,0,4.467,-0.806,5.956,-2.18 l-2.908,-2.259 c-0.806,0.54,-1.837,0.859,-3.048,0.859 c-2.344,0,-4.328,-1.583,-5.036,-3.71 l-3.007,0 l0,2.332 c1.481,2.941,4.525,4.958,8.043,4.958 l0,0 z"
            fill="#34A853"
          ></path>
          <path
            d="M3.96409091,10.71 c-0.18,-0.54,-0.282,-1.117,-0.282,-1.71 c0,-0.593,0.102,-1.17,0.282,-1.71 l0,-2.332 l-3.007,0 c-0.609,1.215,-0.957,2.59,-0.957,4.042 c0,1.452,0.348,2.827,0.957,4.042 l3.007,-2.332 l0,0 z"
            fill="#FBBC05"
          ></path>
          <path
            d="M9,3.57954545 c1.321,0,2.508,0.454,3.44,1.346 l2.582,-2.581 c-1.559,-1.453,-3.596,-2.345,-6.022,-2.345 c-3.518,0,-6.562,2.017,-8.043,4.959 l3.007,2.331 c0.708,-2.127,2.692,-3.71,5.036,-3.71 l0,0 z"
            fill="#EA4335"
          ></path>
        </>
      )}
    </SvgIcon>
  )
}

// Icon source: https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-add-branding-in-azure-ad-apps
export function Microsoft(props: SvgIconProps) {
  const { color } = props
  return (
    <SvgIcon viewBox="0 0 21 21" style={{ fontSize: 21 }} {...props}>
      <rect
        x="1"
        y="1"
        width="9"
        height="9"
        fill={color === 'disabled' ? '#7B7B7B' : '#F25022'}
      />
      <rect
        x="1"
        y="11"
        width="9"
        height="9"
        fill={color === 'disabled' ? '#7B7B7B' : '#00A4EF'}
      />
      <rect
        x="11"
        y="1"
        width="9"
        height="9"
        fill={color === 'disabled' ? '#939393' : '#7FBA00'}
      />
      <rect
        x="11"
        y="11"
        width="9"
        height="9"
        fill={color === 'disabled' ? '#B9B9B9' : '#FFB900'}
      />
    </SvgIcon>
  )
}
