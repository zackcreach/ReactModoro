import { ref } from '~/config/constants'
import { fetchScore, increaseScore, decreaseScore } from '~/api/scores'
import { addUser, addMultipleUsers } from '~/redux/modules/users'
import { fetchUser } from '~/api/users'
import { showFlashNotification } from '~/redux/modules/flashNotification'

const FETCHING_SCORE = 'FETCHING_SCORE'
const FETCHING_SCORE_SUCCESS = 'FETCHING_SCORE_SUCCESS'
const UPDATE_LEADERBOARD = 'UPDATE_LEADERBOARD'
const ADD_LISTENER = 'ADD_LISTENER'
const ADD_SCORES = 'ADD_SCORES'
const INCREMENT_SCORE = 'INCREMENT_SCORE'
const DECREMENT_SCORE = 'DECREMENT_SCORE'

export function incrementScore (uid, amount) {
  return {
    type: INCREMENT_SCORE,
    uid,
    amount,
  }
}

export function decrementScore (uid, amount) {
  return {
    type: DECREMENT_SCORE,
    uid,
    amount,
  }
}

export function updateLeaderboard (uids) {
  return {
    type: UPDATE_LEADERBOARD,
    uids,
  }
}

export function addScores (scores) {
  return {
    type: ADD_SCORES,
    scores,
  }
}

export function addListener () {
  return {
    type: ADD_LISTENER,
  }
}


export function fetchingScore () {
  return {
    type: FETCHING_SCORE,
  }
}

export function fetchingScoreSuccess (uid, score) {
  return {
    type: FETCHING_SCORE_SUCCESS,
    uid,
    score,
  }
}

function usersScores (state = {}, action) {
  switch (action.type) {
    case FETCHING_SCORE_SUCCESS :
      return {
        ...state,
        [action.uid]: action.score
      }
    case ADD_SCORES :
      return {
        ...state,
        ...action.scores,
      }
    case INCREMENT_SCORE :
      return {
        ...state,
        [action.uid]: state[action.uid] + action.amount
      }
    case DECREMENT_SCORE :
      return {
        ...state,
        [action.uid]: state[action.uid] - action.amount
      }
    default :
      return state
  }
}

export function fetchAndHandleScore (uid) {
  return async function (dispatch, getState) {
    dispatch(fetchingScore())
    const scoreInfo = await fetchScore(uid)
    dispatch(fetchingScoreSuccess(uid, !scoreInfo || !scoreInfo.score
                                    ? 0 : scoreInfo.score))
    if (scoreInfo) {
      return dispatch(addUser(uid, {
        uid,
        displayName: scoreInfo.displayName,
        photoURL: scoreInfo.photoURL,
      }))
    } else {
      const user = await fetchUser(uid)
      return dispatch(addUser(uid, user))
    }
  }
}

export function incrementAndHandleScore (amount) {
  return async function (dispatch, getState) {
    const { authedId } = getState().authentication
    dispatch(incrementScore(authedId, amount))
    try {
      increaseScore(authedId, amount)
    } catch (e) {
      dispatch(decrementScore(authedId, amount))
      dispatch(showFlashNotification({text: 'Error updating your state'}))
    }
  }
}

export function decrementAndHandleScore (amount) {
  return async function (dispatch, getState) {
    const { authedId } = getState().authentication
    dispatch(decrementScore(authedId, amount))
    try {
      decreaseScore(authedId, amount)
    } catch (e) {
      dispatch(incrementScore(authedId, amount))
      dispatch(showFlashNotification({text: 'Error updating your state'}))
    }
  }
}

export function fetchAndSetScoresListener () {
  let listenerSet = false
  return async function (dispatch, getState) {
    ref.child('scores')
      .orderByChild('scores')
      .limitToLast(15)
      .on('value', (snapshot) => {
      const scores = snapshot.val() || {}
      const leaderboardUids = Object.keys(scores)
        .sort((a,b) => scores[b].score - scores[a].score)
        .filter((uid) => !!scores[uid].score || scores[uid].score > 0)

      const {justScores, users } = leaderboardUids.reduce((prev, uid) => {
        prev.justScores[uid] = scores[uid].score
        prev.users[uid] = {
          displayName: scores[uid].displayName,
          photoURL: scores[uid].photoURL,
          uid: scores[uid].uid,
        }
        return prev
      }, {justScores: {}, users: {}})

      dispatch(updateLeaderboard(leaderboardUids))
      dispatch(addScores(justScores))
      dispatch(addMultipleUsers(users))

      if (listenerSet === false) {
        dispatch(addListener())
        listenerSet = true
      }
    })
  }
}

const initialState =  {
  isFetching: true,
  listenerSet: false,
  leaderboardUids: [],
  usersScores: {},
}

export default function scores (state = initialState, action) {
  switch (action.type) {
    case FETCHING_SCORE :
      return {
        ...state,
        isFetching: true,
      }
    case FETCHING_SCORE_SUCCESS :
      return {
        ...state,
        isFetching: false,
        usersScores: usersScores(state.usersScores, action)
      }
    case UPDATE_LEADERBOARD :
      return {
        ...state,
        leaderboardUids: action.uids,
      }
    case ADD_SCORES :
    case INCREMENT_SCORE :
    case DECREMENT_SCORE :
      return {
        ...state,
        usersScores: usersScores(state.usersScores, action)
      }
    case ADD_LISTENER :
      return {
        ...state,
        listenerSet: true,
      }
    default :
      return state
  }
}
