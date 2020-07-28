interface storage {
    watchlist: watchlistTask[],
    user: user,
    email: emailSettings
}

type watchTaskData = {
    type: 'watchTask'
    url: string,
    title: string,
    data: watchablePath[]
}
type watchablePath = {
    xpath: string,
    text: string | null
}

interface watchlistTask extends watchTaskData {
    alarmId?: string,
    recheckPeriod?: number,
    diffChanges?: taskDiffData[]
}

interface user {
    email: string,
    name: string
}

interface emailSettings {
    subject: string,
    body: string;
    pauseDuration: number
}

type xhr = {
    type: string,
    url: string,
    async: boolean,
    data?: any,
    xhrCallback?: Function,
    headers?: xhrHeaders
}

type xhrHeaders = {
    accept?: string,
    'X-RequestDigest'?: string,
    'content-Type'?: string,
    'If-Match'?: string,
    'X-Http-Method'?: string,
    'authorization'?: string
}

type watchlistTaskDiff = {
    type: 'diffCheck',
    hasChanged: boolean,
    changes: taskDiffData[],
    alarmId: string,
    website: string,
    title: string
}

type taskDiffData = {
    original: string,
    current: string,
    time: number
}
