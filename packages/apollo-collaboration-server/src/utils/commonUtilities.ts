import { Injectable } from '@nestjs/common'

@Injectable()
export class CommonUtilities {
  /**
   * Returns current datetime in the following format ddmmyyyy_hh24miss
   * @returns Returns current datetime in the following format ddmmyyyy_hh24miss
   */
  getCurrentDateTime() {
    const date = new Date()
    const dayNber = `0${date.getDate()}`.slice(-2)
    const monthNber = `0${date.getMonth() + 1}`.slice(-2)
    const yearNber = date.getFullYear().toString()
    const hourNber = `0${date.getHours()}`.slice(-2)
    const minuteNber = `0${date.getMinutes()}`.slice(-2)
    const secondNber = `0${date.getSeconds()}`.slice(-2)
    const ret = `${
      dayNber + monthNber + yearNber
    }_${hourNber}${minuteNber}${secondNber}`
    return ret
  }
}
