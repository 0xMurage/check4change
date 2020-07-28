/**
 * Receives new task to be added on watchlist from background script
 * User can add task to watchlist,
 * User can edit task on the watchlist
 * User can pause all the tasks list
 * User can delete all the tasks on watchlist
 */
class WatchlistManager {
    private readonly storageKey = 'changerTasks';
    private taskPendingWatchlist ?: watchTaskData;

    constructor() {
        this.newTaskListener();
        this.renderWatchListTasks();
        this.eventsInit();
    }

    eventsInit() {

        document.querySelector('.modal')?.addEventListener('click', (evt) => {
            // @ts-ignore
            if (evt?.target?.classList && evt.target?.classList?.contains('modal')) {
                // @ts-ignore
                evt.target?.classList?.remove('show');
            }
        });
        document.querySelector('.modal .close')?.addEventListener('click', () => {
            this.hideTaskModal();
        });

        document.querySelector('#btn-cancel-save')?.addEventListener('click', () => {
            this.hideTaskModal();
        });


        document.querySelector('#btn-save')?.addEventListener('click', () => {
            this.saveTask();
        });


        document.querySelectorAll('#watchlist-table')
            ?.forEach((elem) => {
                elem.addEventListener('click', (evt) => {
                    // @ts-ignore
                    if (evt.target.classList.contains('btn-view')) {
                        // console.dir(evt.target?.dataset?.id)
                        this.showTaskModal();
                        return;
                    }
                    // @ts-ignore
                    if (evt.target.classList.contains('btn-delete')) {
                        if (confirm('Are you sure you want to stop monitoring changes for this site?')) {
                            // @ts-ignore
                            this.removeWatchlistTask(evt?.target?.dataset?.id)
                                .then(() => {
                                    this.renderWatchListTasks();
                                }).catch(() => {
                                alert('Unable to remove the task. Kindly try again later')
                            })
                        }
                    }

                })
            });

        (<HTMLButtonElement>document.getElementById('btn-settings')).addEventListener('click', () => {
            this.showSettings()
        });

        document.getElementById('btn-hide-settings')?.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        (<HTMLButtonElement>document.getElementById('btn-save-settings')).addEventListener('click', () => {
            this.saveUserSettings();
        });

        (<HTMLButtonElement>document.getElementById('main-btn-refresh')).addEventListener('click', () => {
            this.renderWatchListTasks();
        })


    }

    newTaskListener() {
        chrome?.runtime?.onMessage?.addListener(((task: watchTaskData, sender, sendResponse) => {
            if (task && task.data) {
                //show popup for user to set timer
                const titleElem: HTMLInputElement | null = document.querySelector('#title');
                if (titleElem) {
                    titleElem.value = task.title;
                    this.taskPendingWatchlist = task;
                    this.showTaskModal();
                }
                sendResponse('ok')
            } else {
                sendResponse('error')
            }
        }));
    }


    saveTask() {
        if (!this.taskPendingWatchlist) {
            alert('Unable to retrieve the selected content for monitoring. Try again');
            return;
        }
        //get the alarm duration
        const durationElem: HTMLInputElement | null = <HTMLInputElement>document.getElementById('recheck-duration');

        if (!durationElem || !durationElem?.value) {
            alert('Unable to retrieve the recheck duration');
            return;
        }

        if (Number(durationElem.value) < Number(durationElem.min) || Number(durationElem.value) > Number(durationElem.max)) {
            alert(`Duration can only be between ${durationElem.min} and ${durationElem.max} minutes. Try again `);
            return;
        }

        this.taskPendingWatchlist.title = (<HTMLInputElement>document.getElementById('title')).value;

        //add alarm Add an alarm for the job
        const task = this.createTaskAlarm(this.taskPendingWatchlist, Number(durationElem.value));

        this.loadStoredData()
            .then((data) => {
                if (!data) {
                    data = {
                        watchlist: [],
                        email: {body: '', subject: '', pauseDuration: 4},
                        user: {name: '', email: ''}
                    };
                    alert('Email notifications are disabled as there currently no set email')
                }
                data.watchlist.push(task);
                this.storeData(data).then((value => {
                    this.renderWatchListTasks();
                    this.hideTaskModal();
                    console.log('all saved', value)
                }))
            }).catch((error) => {
            console.error(error);
            console.log('error occurred XXX1029')
        });
    }

    createTaskAlarm(task: watchTaskData, recheckAfter, alarmId?: string): watchlistTask {
        let alarmName = alarmId ? alarmId : `alarm${this.generateRandomID()}`;
        chrome.alarms.create(alarmName, {periodInMinutes: recheckAfter});

        return {
            data: task.data,
            alarmId: alarmName,
            url: task.url,
            type: task.type,
            diffChanges: [],
            recheckPeriod: recheckAfter,
            title: task.title
        };
    }


    showTaskManagerPopup(alarmId: string, editing = true) {

    }

    /**
     * Display all tasks currently on the watchlist
     */
    renderWatchListTasks() {
        this.loadStoredData().then((data) => {
            let rows = '';
            let index = 1;
            if (data.watchlist.length == 0) {
                rows = `<tr> <td></td><td></td><td></td><td></td><td></td> </tr>`
            }
            data.watchlist.forEach((task) => {

                rows += `
                <tr>
                    <td>${index}</td>
                    <td>${task.title}</td>
                    <td>${task.recheckPeriod}</td>` +
                    // @ts-ignore
                    `<td>${this.convertToHumanFriendlyDate(task.diffChanges[0]?.time || '') || '---'}</td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-view" data-id="${task.alarmId}">view details</button>
                        <button class="btn btn-sm btn-danger btn-delete" data-id="${task.alarmId}">remove</button>
                        <a target="_blank" class="btn btn-dark" href="${task.url}"> view site</a>
                    </td>
                </tr>
                `;
            });
            (<HTMLTableElement>document.querySelector('#watchlist-table tbody')).innerHTML = rows;
        }).catch((err) => {
            console.log(err)
        })
    }


    /**
     * Show user settings
     */
    showSettings() {
        this.loadStoredData().then((d) => {

            if (!d.user) {
                this.showSettingsModal();
                return;
            }

            (<HTMLInputElement>document.getElementById('name')).value = d.user.name;
            (<HTMLInputElement>document.getElementById('email')).value = d.user.email;
            (<HTMLInputElement>document.getElementById('pause-duration')).value =
                d.email.pauseDuration.toString();

            this.showSettingsModal();

        }).catch(() => {
            alert('unexpected error encountered. Kindly try again')
        })
    }

    saveUserSettings() {
        const name = (<HTMLInputElement>document.getElementById('name')).value;
        const email = (<HTMLInputElement>document.getElementById('email')).value;
        const duration = (<HTMLInputElement>document.getElementById('pause-duration'));
        if (!name) {
            alert('Valid name is required');
            return;
        }
        if (!email || !new RegExp(`^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$`).test(email)) {
            alert('Email is invalid');
            return;
        }
        if (!duration || !duration.value || Number(duration.value) > Number(duration.max) ||
            Number(duration.value) < Number(duration.min)) {
            alert(`Pause duration can only be between ${duration.min} and ${duration.max}`);
            return;
        }

        this.loadStoredData().then((d) => {
            d.user.name = name;
            d.user.email = email;
            d.email.pauseDuration = Number(duration.value);
            this.storeData(d).then(() => {
                this.hideSettingsModal();
                alert('Details updated successfully');
            }).catch(() => {
                alert('unexpected error encountered. kindly try again')
            })
        })
    }

    restartAllAlarms() {
        this.loadStoredData().then((data) => {
            if (data) {
                data.watchlist.forEach((task: watchlistTask) => {
                    //we will not clear the alarm, but recreate with the alarm ID
                    this.createTaskAlarm(task, task.recheckPeriod, task.alarmId);
                })
            } else {
                console.error('cannot restart empty task')
            }
        }).catch((err) => {
            console.log('could not load all data XCEUY32', err)
        });

    }

    /**
     * delete all tasks and clear all alarms
     */
    removeAllWatchlistTasks(): Promise<string> {
        return this.loadStoredData().then((data) => {
            if (!data || !data.watchlist) {
                console.log('no task found');
                return "no task on watchlist found";
            }

            data.watchlist.forEach((task) => {
                if (task.alarmId)
                    this.clearAlarm(task.alarmId).then((r) => console.log('cleared alarm ' + task.alarmId))
            });

            delete data.watchlist;
            return this.storeData(data)
                .then((d) => "All tasks on watchlist have been cleared")
                .catch(() => "Unexpected error encountered");
        });

    }

    removeWatchlistTask(taskAlarmId): Promise<string> {
        return this.loadStoredData().then((data) => {
            if (!data) {
                return 'No task on watchlist';
            }
            let index = data.watchlist.findIndex((value => value.alarmId == taskAlarmId));
            if (index == -1) {
                return 'No task with similar ID on the watchlist'
            }

            const alarmId = data.watchlist[index].alarmId;
            if (alarmId) {
                this.clearAlarm(alarmId).then((d) => console.log('alarm cleared'))
            }

            data.watchlist.splice(index, 1);
            //save the data
            return this.storeData(data)
                .then(() => 'ok')
                .catch(() => 'Data not refreshed')

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

    destroyAllAlarms(): Promise<string> {
        return new Promise(((resolve, reject) => {
            chrome.alarms.clearAll((d) => {
                if (d) return resolve('cleared all');
                reject('unexpected error encountered')
            })

        }))
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
                    if (!data[this.storageKey]) {
                        resolve({
                            watchlist: [],
                            email: {body: '', subject: '', pauseDuration: 4},
                            user: {name: '', email: ''}
                        });
                    }
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

    showTaskModal() {
        document.querySelector('#task-modal')?.classList.add('show');
    }


    showSettingsModal() {
        document.querySelector('#settings-modal')?.classList.add('show');
    }

    hideTaskModal() {
        document.querySelector('#task-modal')?.classList.remove('show')
    }

    hideSettingsModal() {
        document.querySelector('#settings-modal')?.classList.remove('show')
    }

    convertToHumanFriendlyDate(d: string | number) {
        if (!d) {
            return
        }
        return new Date(d).toLocaleDateString('en-US',
            {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'});
    }


}

document.addEventListener('DOMContentLoaded', () => {
    new WatchlistManager();
});

