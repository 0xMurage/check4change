/**
 * Receives new task to be added to watchlist and forwards it to watchlist manager
 * Listen to alarm events
 * Send task to difference checker script on alarm
 * Trigger notification on change difference. Also triggers sending email + playing audio
 */

class Background {
    private readonly storageKey = 'changerTasks';
    private lastAlarm;

    constructor() {
        this.messageListenerHandler();
        this.alarmEventHandler();
    }

    messageListenerHandler() {
        chrome.runtime.onMessage.addListener(((message: watchlistTask | watchlistTaskDiff, sender, sendResponse) => {
            if (!message) return;
            //on watch task
            if (message.type == 'watchTask') {
                sendResponse('ok');
                //add the task as pending
                chrome.tabs.create({url: '/pages/inbox.html'}, (tab) => {
                    //if the tab has been loaded,
                    chrome.tabs.onUpdated.addListener(((tabId, changeInfo) => {
                        if (changeInfo.status == 'complete' && tabId == tab.id) {
                            //send the data to the tab
                            if (tab.id != null) {
                                chrome.tabs.sendMessage(tab.id, message);
                            }


                        }
                    }));
                });
            }

            if (message.type == 'diffCheck') {
                sendResponse('ok');
                this.diffResponseHandler(message);
                return;
            }

        }));

    }


    diffResponseHandler(diffData: watchlistTaskDiff) {
        if (diffData.hasChanged) {
            this.notifyUser({
                message: diffData.title+ ' has been updated.',
                type: notificationType.success,
                email: true,
                data: diffData
            });
        }
        this.getAlarmTask(diffData.alarmId).then((task) => {
            if (task) {
                this.updateTaskDiffData(<watchlistTask>task, diffData.changes)
            } else {
                console.error('task with alarm id not found')
            }
        })
    }

    alarmEventHandler() {
        chrome.alarms.onAlarm.addListener((alarm => {
            this.getAlarmTask(alarm.name).then((task) => {
                if (task) {
                    this.startDiffCheckProcess(<watchlistTask>task);
                } else {
                    console.error('task with alarm id not found')
                }
            }).catch((error) => {
                console.error(error);
                this.notifyUser({message: 'Task not found ', type: notificationType.error});
                this.clearAlarm(alarm.name).then(() => console.log('alarms cleared'))
                    .catch((error) => console.error(error))
            })

        }))
    }

    startDiffCheckProcess(task: watchlistTask) {
        chrome.tabs.create({
            active: false,
            index: 0,
            url: task.url,
            pinned: true
        }, (tab => {
            //check when tab is fully loaded
            chrome.tabs.onUpdated.addListener(((tabId, changeInfo) => {
                if (changeInfo.status == 'complete' && tabId == tab.id) {
                    //inject diff checker content script
                    chrome.tabs.executeScript(tab.id, {
                        file: 'assets/scripts/diff-checker.js'
                    }, (result => {
                        if (result[0] !== true) {
                        }
                        //send the data to the tab
                        if (tab.id != null) {
                            chrome.tabs.sendMessage(tab.id, task);
                        }
                    }));


                }
            }));

        }))
    }

    updateTaskDiffData(task: watchlistTask, differences: taskDiffData[]) {
        this.loadStoredData()
            .then((old) => {

                if (!old) {
                    return;
                }
                //find the task associated to alarm ID
                let obj = old.watchlist.find((d) => d.alarmId == task.alarmId);
                if (!obj) {
                    console.log('task associated to the alarm id not found');
                    return;
                }
                obj.diffChanges = differences; //update by reference

                //re-save the tasks
                this.storeData(old).then(() => console.log('saved the data')).catch((er) => console.log(er))

            }).catch((err) => {
            console.log(err)
        });

    }

    clearAlarm(alarmId: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            chrome.alarms.clear(alarmId, (cleared) => {
                if (cleared) return resolve(true);
                return reject(false);
            })
        })
    }

    getAlarmTask(alarmId): Promise<watchlistTask | string | void> {
        if (!alarmId) {
            return Promise.resolve('Alarm Id cannot be null')
        }

        return this.loadStoredData()
            .then((data) => {
                return data.watchlist.find((d) => d.alarmId === alarmId);
            }).catch((error) => {
                console.error(error);
                return "No task found";
            })
    }

    notifyUser(params: { message: string, type: notificationType, email?: boolean, data?: any }) {

        chrome.notifications.create('dix3eji8rs', {
            type: 'basic',
            title: 'AC4C Updates ',
            iconUrl: 'assets/images/sample_16.png',
            message: params.message
        });

        this.playAudio(notificationType.success);

        if (params.email) {
            this.sendEmailNotification(<watchlistTaskDiff>params.data);
        }
    }

    playAudio(type: notificationType) {
        let playback = new Audio();
        playback.src = chrome.runtime.getURL('assets/sounds/cool.mp3');
        playback.volume = 1;
        playback.play()
    }

    sendEmailNotification(params: watchlistTaskDiff) {
        console.log('this is very important change: ', params.changes);

        const now = new Date().getTime();
        if (!this.lastAlarm) {
            this.lastAlarm = now
        }

        this.loadStoredData().then((data) => {

            if (!data || !data.user || !data.user.email) {
                //just break.
                console.log('no email set ');
                return;
            }
            const pauseDuration = (data.email.pauseDuration || 1) * 60 * 60;
            if (this.lastAlarm !== now && this.lastAlarm + pauseDuration < now) {
                console.log('email sending paused for now');
                return;
            }

            const mailBody = this.mailBody({
                name: data.user.name,
                changes: params.changes,
                siteUrl: params.website,
                siteTitle: params.title
            });

            const apiKey = 'api key here';
            const url = 'https://api.sendgrid.com/v3/mail/send';
            const payload = {
                personalizations: [{to: [{email: data?.user?.email}]}],
                from: {email: 'sender email here'},
                subject: data?.email?.subject || params?.title || 'Check 4 Change Updates',
                content: [{type: 'text/html', value: mailBody}]

            };

            this.ajax({
                url: url,
                type: 'post',
                data: JSON.stringify(payload),
                async: true,
                headers: {
                    authorization: `Bearer ${apiKey}`
                }
            })

        }).catch((error) => {
            console.error(error);
        });

    }

    ajax(options: xhr): Promise<any> {
        return new Promise(((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.open(options.type, options.url, options.async);

            xhr.setRequestHeader('Content-Type',
                options.headers && options.headers["content-Type"] ?
                    options.headers["content-Type"] : 'application/json');

            xhr.setRequestHeader('Accept',
                options.headers && options.headers.accept ?
                    options.headers.accept : 'application/json');

            if (options.headers?.authorization) {
                xhr.setRequestHeader('Authorization', options.headers.authorization)
            }

            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    resolve(xhr)
                }
                if (xhr.status > 399) {
                    reject(xhr)
                }
            };
            options.data ? xhr.send(options.data) : xhr.send();

        }));
    }

    generateRandomID() {
        return Math.ceil(Math.random() * Math.pow(10, 15));
    }

    async loadStoredData(): Promise<storage> {
        return await new Promise(((resolve, reject) => {
            chrome.storage.local.get(this.storageKey, (data) => {
                if (!data) {
                    console.error('no data found')
                    reject('data not found')
                } else {
                    resolve(data[this.storageKey]);
                }
            })
        }))
    }

    async storeData(data: storage) {
        return await new Promise(((resolve) => {
            const allStoredData = {};
            allStoredData[this.storageKey] = data;
            chrome.storage.local.set(allStoredData, () => {
                resolve('data persisted')
            })
        }))
    }

    mailBody(d: { name: string, siteTitle: string, siteUrl: string, changes: taskDiffData[] }) {
        let diff = '';

        d.changes.forEach((di) => {
            diff += `<tr style="height: 45px;">
<td style="width: 159px; height: 45px;"><span style="color: #ff0000;">${di.original}</span></td>
<td style="width: 135px; height: 45px;"><span style="color: #00ff00;">${di.current}</span></td>
</tr>`
        });

        return `<p style="text-align: justify;">Dear ${d.name},</p>
<p style="text-align: justify;">there are new updates from ${d.siteTitle} site.</p>
<table style="width: 250px; height: 53px;">
<tbody>
<tr style="height: 8px;">
<td style="width: 103px; height: 8px;">Original content</td>
<td style="width: 135px; height: 8px;">Current content</td>
</tr>` + diff + `
</tbody>
</table>
<p style="text-align: justify;"><span style="color: #000000;"> Click <a style="color: #000000;" href="${d.siteUrl}">` +
            `here</a> to view the update.</span></p><p style="text-align: justify;">Kind regards,</p>
<p style="text-align: justify;">JC4C Team.</p>`
    }
}

new Background();

enum notificationType {
    error = 'error',
    success = 'success',

}
