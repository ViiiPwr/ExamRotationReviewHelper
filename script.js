const reviewOffsets = [0, 1, 3, 6, 14, 29, 44];
let allSchedules = JSON.parse(localStorage.getItem('schedules') || '[]');
let pooledTasks = JSON.parse(localStorage.getItem('pooledTasks') || '[]');
let poolCapacity = parseInt(localStorage.getItem('poolCapacity') || '10', 10); // 默认10

function saveData() {
    localStorage.setItem('schedules', JSON.stringify(allSchedules));
    localStorage.setItem('pooledTasks', JSON.stringify(pooledTasks));
    localStorage.setItem('poolCapacity', poolCapacity);
}

setInterval(() => {
    downloadData();
}, 86400000);

const normalReviewOffsets = [0, 1, 3, 6, 14, 29, 44];
const quickReviewOffsets = [0, 3, 6, 14, 29];

function addSchedule() {
    const name = document.getElementById("eventName").value.trim();
    const startDateStr = document.getElementById("startDate").value;
    const reviewMode = document.getElementById("reviewMode").value;
    const priority = document.getElementById("priority") ? document.getElementById("priority").value : "low";
    
    if (!name || !startDateStr) {
        alert("请填写名称和开始时间");
        return;
    }

    const startDate = new Date(startDateStr);
    let scheduleQueue = [];
    
    let selectedOffsets;
    switch(reviewMode) {
        case 'quick':
            selectedOffsets = quickReviewOffsets;
            break;
        case 'single':
            selectedOffsets = [0];
            break;
        default:
            selectedOffsets = normalReviewOffsets;
    }

    selectedOffsets.forEach((offset, index) => {
        const reviewDate = new Date(startDate);
        reviewDate.setDate(reviewDate.getDate() + offset);
        scheduleQueue.push({
            name,
            round: index + 1,
            date: reviewDate.toISOString().split('T')[0],
            completed: false,
            priority // 新增优先级
        });
    });

    scheduleQueue.forEach(schedule => {
        let currentDate = new Date(schedule.date);
        let targetDate = currentDate.toISOString().split('T')[0];

        while (allSchedules.filter(item => item.date === targetDate).length >= 4) {
            currentDate.setDate(currentDate.getDate() + 1);
            targetDate = currentDate.toISOString().split('T')[0];
        }

        allSchedules.push({
            name: schedule.name,
            round: schedule.round,
            date: targetDate,
            completed: schedule.completed,
            priority: schedule.priority // 新增优先级
        });
    });

    saveData();
    alert("已添加日程并生成复习计划！");
    renderSchedule();
}

function renderSchedule() {
    const viewMonth = document.getElementById("viewMonth").value;
    if (!viewMonth) return;

    const [year, month] = viewMonth.split("-");
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const firstDayWeekday = firstDay.getDay();

    let calendar = {};
    allSchedules.forEach((item, idx) => {
        if (item.date.startsWith(viewMonth)) {
            if (!calendar[item.date]) calendar[item.date] = [];
            calendar[item.date].push({ ...item, index: idx });
        }
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let html = `<table class="calendar-table"><thead><tr>`;
    ["日", "一", "二", "三", "四", "五", "六"].forEach(day => {
        html += `<th>${day}</th>`;
    });
    html += `</tr></thead><tbody>`;

    let dayCounter = 1;
    for (let row = 0; row < 5; row++) {
        html += `<tr>`;
        for (let col = 0; col < 7; col++) {
            if (row === 0 && col < firstDayWeekday) {
                html += `<td></td>`;
            } else if (dayCounter <= lastDay) {
                const dateStr = `${year}-${month}-${String(dayCounter).padStart(2, '0')}`;
                const items = calendar[dateStr] || [];
                const content = items.map(item => {
                    const titleStyle = item.round === 1 ? 'style="color: #4CAF50;"' : '';
                    const priorityClass = item.priority === "high" ? "priority-high" : (item.priority === "medium" ? "priority-medium" : "");
                    const priorityIcon = item.priority === "high" ? "🔥" : (item.priority === "medium" ? "⭐" : "");
                    return `<div class="${item.completed ? 'completed' : 'drop-target'} draggable task-item ${priorityClass}" draggable="true"
                ondragstart="handleDragStart(event, ${item.index})">
                <input type="checkbox" onchange="toggleComplete(${item.index})" ${item.completed ? 'checked' : ''}>
                <span ${titleStyle}>${priorityIcon}${item.name}-R${item.round}</span>
              </div>`;
                }).join("");
                const rowClass = content ? (dateStr === todayStr ? 'highlight' : '') : 'no-task-row';

                html += `<td class="${rowClass}" ondrop="handleDrop(event, '${dateStr}')" ondragover="allowDrop(event)">
              <div style="font-weight: bold">${dayCounter}</div><br>${content}</td>`;
                dayCounter++;
            } else {
                html += `<td></td>`;
            }
        }
        html += `</tr>`;
    }
    html += `</tbody></table>`;

    document.getElementById("calendar").innerHTML = html;
    updateStats();
    renderTaskPool(); // 添加这一行
}

function handleDragStart(event, index) {
    event.dataTransfer.setData("text", index);
}

function allowDrop(event) {
    event.preventDefault();
}

function handleDrop(event, targetDate) {
    event.preventDefault();
    const draggedIndex = event.dataTransfer.getData("text");
    const source = event.dataTransfer.getData("source") || "schedule";

    if (source === "schedule") {
        const draggedSchedule = allSchedules[draggedIndex];
        const newDate = new Date(targetDate);
        draggedSchedule.date = newDate.toISOString().split('T')[0];
    } else if (source === "pool") {
        const draggedTask = pooledTasks[draggedIndex];
        pooledTasks.splice(draggedIndex, 1);
        allSchedules.push({
            ...draggedTask,
            date: targetDate
        });
    }

    saveData();
    renderSchedule();
    renderTaskPool();
}

function handlePoolDrop(event) {
    event.preventDefault();
    if (pooledTasks.length >= poolCapacity) {
        alert('任务池已达容量上限，无法继续添加任务！');
        return;
    }
    const draggedIndex = event.dataTransfer.getData("text");
    const draggedSchedule = allSchedules[draggedIndex];

    pooledTasks.push({
        name: draggedSchedule.name,
        round: draggedSchedule.round,
        completed: draggedSchedule.completed,
        priority: draggedSchedule.priority // 保证优先级不丢失
    });

    allSchedules.splice(draggedIndex, 1);

    saveData();
    renderSchedule();
    renderTaskPool();
}

function handleDragStart(event, index, source = "schedule") {
    event.dataTransfer.setData("text", index);
    event.dataTransfer.setData("source", source);
}

function renderTaskPool() {
    const poolHtml = pooledTasks.map((task, index) => {
        const priorityClass = task.priority === "high" ? "priority-high" : (task.priority === "medium" ? "priority-medium" : "");
        const priorityIcon = task.priority === "high" ? "🔥" : (task.priority === "medium" ? "⭐" : "");
        return `<div class="task-item ${priorityClass}" draggable="true" 
             ondragstart="handleDragStart(event, ${index}, 'pool')">
            <span>${priorityIcon}${task.name}-R${task.round}</span>
        </div>`;
    }).join('');

    document.getElementById("taskPool").innerHTML = poolHtml || '<p>暂无待处理的任务</p>';
    // 显示容量信息
    const info = `(${pooledTasks.length} / ${poolCapacity})`;
    document.getElementById('poolCapacityInfo').textContent = info;
    document.getElementById('poolCapacity').value = poolCapacity;
}

function toggleComplete(index) {
    allSchedules[index].completed = !allSchedules[index].completed;
    saveData();
    renderSchedule();
}

function updateStats() {
    const totalTasks = allSchedules.length;
    const completedTasks = allSchedules.filter(item => item.completed).length;
    const uncompletedTasks = totalTasks - completedTasks;

    if (totalTasks === 0) {
        document.getElementById("stats").innerHTML = `
      <p>没有复习计划。</p>
    `;
        return;
    }

    const latestSchedule = allSchedules.reduce((latest, item) => {
        const itemDate = new Date(item.date);
        return itemDate > latest ? itemDate : latest;
    }, new Date(0));

    const earliestSchedule = allSchedules.reduce((earliest, item) => {
        const itemDate = new Date(item.date);
        return itemDate < earliest ? itemDate : earliest;
    }, new Date());

    const latestScheduleDate = latestSchedule.toISOString().split('T')[0];
    const earliestScheduleDate = earliestSchedule.toISOString().split('T')[0];

    const timeDifference = Math.floor((latestSchedule - earliestSchedule) / (1000 * 60 * 60 * 24));

    const fifthRoundSchedules = allSchedules.filter(item => item.round === 5);
    const lastFifthRound = fifthRoundSchedules.reduce((latest, item) => {
        const itemDate = new Date(item.date);
        return itemDate > latest ? itemDate : latest;
    }, new Date(0));

    const fifthRoundTimeDifference = Math.floor((lastFifthRound - earliestSchedule) / (1000 * 60 * 60 * 24));

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = allSchedules.filter(item => item.date === todayStr && !item.completed).length;

    const completionRate = totalTasks ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;

    const progressBarWidth = 300;
    const progressWidth = Math.round((completedTasks / totalTasks) * progressBarWidth);

    const statsHtml = `
    <p>总任务数：${totalTasks}</p>
    <p>已完成：${completedTasks} | 未完成：${uncompletedTasks}</p>
    <p style="color:#4CAF50;">最晚复习日程：${latestScheduleDate}</p>
    <p style="color:#4CAF50;">完成所有复习所需时间：${timeDifference} 天</p>
    <p style="color:#4CAF50;">完成第五轮复习所需时间：${fifthRoundTimeDifference} 天</p>
    <p>完成率：${completionRate}%</p>
    <div class="progress-bar">
      <div class="progress" style="width: ${progressWidth}px;"></div>
    </div>
    <br>
    <details>
      <summary>复习思路参考:</summary>
      <p>第一遍R1 过讲义 挖空 1<br>
      第二遍R2 做题 2<br>
      第三遍R3 讲义 4<br>
      第四遍R4 思维导图课7<br>
      第五遍R5 做题 整理自己的anki 15<br>
      第六遍R6 导图课 30<br>
      第七遍R7 导图or讲义 + 做题 排除最近五年的题目 45</p>
    </details>
  `;
    document.getElementById("stats").innerHTML = statsHtml;
}

function downloadData() {
    const exportData = {
        schedules: allSchedules,
        pooledTasks: pooledTasks
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const link = document.createElement('a');
    link.setAttribute("href", dataStr);
    link.setAttribute("download", "review_schedule.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function luckyDraw() {
    if (pooledTasks.length === 0) {
        alert("任务池中没有可抽取的任务！");
        return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 检查今天的任务数量
    const todayTasks = allSchedules.filter(task => task.date === todayStr).length;
    if (todayTasks >= 4) {
        alert("今天的任务已经达到上限（4个），请选择其他日期！");
        return;
    }

    // 随机选择一个任务
    const randomIndex = Math.floor(Math.random() * pooledTasks.length);
    const luckyTask = pooledTasks[randomIndex];
    
    // 从任务池中移除该任务
    pooledTasks.splice(randomIndex, 1);
    
    // 添加到今天的日程中
    allSchedules.push({
        ...luckyTask,
        date: todayStr
    });

    saveData();
    renderSchedule();
    renderTaskPool();
    alert(`已将任务 "${luckyTask.name}-R${luckyTask.round}" 添加到今天的日程中！`);
}

function uploadData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData.schedules && Array.isArray(importedData.schedules)) {
                // 兼容旧数据：为没有 priority 字段的任务赋默认值
                allSchedules = importedData.schedules.map(item => ({
                    ...item,
                    priority: item.priority || "low"
                }));
                if (importedData.pooledTasks && Array.isArray(importedData.pooledTasks)) {
                    pooledTasks = importedData.pooledTasks.map(item => ({
                        ...item,
                        priority: item.priority || "low"
                    }));
                }
                saveData();
                alert("数据导入成功！");
                renderSchedule();
            } else if (Array.isArray(importedData)) {
                // 兼容更早的旧版本格式
                allSchedules = importedData.map(item => ({
                    ...item,
                    priority: item.priority || "low"
                }));
                saveData();
                alert("数据导入成功！（旧版本格式）");
                renderSchedule();
            } else {
                alert("导入的数据格式不正确！");
            }
        } catch (err) {
            alert("读取文件时出错：" + err.message);
        }
    };
    reader.readAsText(file);
}

function updateCountdown() {
    const examDate = new Date('2025-12-20T00:00:00+08:00');
    const now = new Date();
    const timeDifference = examDate - now;

    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

    document.getElementById("countdown").innerHTML = `
    <strong>考研倒计时：</strong> ${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒
  `;
}

function updateTodayInfo() {
    const today = new Date();
    const daysOfWeek = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const weekDay = daysOfWeek[today.getDay()];
    document.getElementById("todayInfo").innerHTML = `今天是：${todayStr} ${weekDay}`;
}

function exportToICS() {
    if (allSchedules.length === 0) {
        alert("暂无日程数据可导出");
        return;
    }

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ebbinghaus Review Helper//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    let existingUIDs = new Set();

    allSchedules.forEach(item => {
        const dateStr = item.date.replace(/-/g, '');
        const start = `${dateStr}`;
        const end = `${dateStr}`;
        const uid = `${start}-${item.name}`;

        if (existingUIDs.has(uid)) {
            return;
        }

        existingUIDs.add(uid);

        icsContent += `BEGIN:VEVENT
SUMMARY:${item.name}（第${item.round}次复习）
DTSTART;TZID=Asia/Shanghai;VALUE=DATE:${start}
DTEND;TZID=Asia/Shanghai;VALUE=DATE:${end}
DESCRIPTION:艾宾浩斯记忆曲线复习助手提醒
STATUS:CONFIRMED
SEQUENCE:0
UID:${uid}
BEGIN:VALARM
TRIGGER:-PT10M
ACTION:DISPLAY
DESCRIPTION:提醒你复习【${item.name}】
END:VALARM
END:VEVENT
`;
    });

    icsContent += `END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'review_schedule.ics';
    link.click();
}

let previousSchedules = [];

function skipToday() {
    if (allSchedules.length === 0) {
        alert("暂无日程数据可操作");
        return;
    }

    previousSchedules = JSON.parse(JSON.stringify(allSchedules));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allSchedules.forEach(item => {
        const itemDate = new Date(item.date);

        if (itemDate >= today && !item.completed) {
            itemDate.setDate(itemDate.getDate() + 1);
            item.date = itemDate.toISOString().split('T')[0];
        }
    });

    saveData();
    renderSchedule();
    alert("所有今天及以后日程已推迟一天！");
}

function undoSkipToday() {
    if (previousSchedules.length === 0) {
        alert("没有可撤销的操作");
        return;
    }

    allSchedules = previousSchedules;
    saveData();
    renderSchedule();
    alert("操作已撤销，日程恢复到原状态");
}

function deleteSchedulesByName() {
    const nameToDelete = document.getElementById("deleteEventName").value.trim();

    if (!nameToDelete) {
        alert("请填写日程名称");
        return;
    }

    const initialScheduleCount = allSchedules.length;
    allSchedules = allSchedules.filter(schedule =>
        schedule.name !== nameToDelete || schedule.completed === true
    );

    const deletedSchedules = initialScheduleCount - allSchedules.length;

    if (deletedSchedules === 0) {
        alert("未找到匹配的日程名称，或者所有匹配的日程已完成");
    } else {
        saveData();
        alert(`已删除所有未完成的名称为 "${nameToDelete}" 的日程`);
        renderSchedule();
    }
}

document.getElementById('clear-all-schedules').addEventListener('click', function() {
    const confirmClear = confirm("你确定要清空所有日程吗？此操作无法撤销！");

    if (confirmClear) {
        allSchedules = [];
        pooledTasks = []; // 同时清空任务池
        saveData();
        renderSchedule();
        alert('所有日程已清空！');
    }
});

window.onload = () => {
    updateCountdown();
    updateTodayInfo();

    const today = new Date();
    document.getElementById("startDate").valueAsDate = today;

    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById("viewMonth").value = currentMonth;

    setInterval(updateCountdown, 1000);
    setInterval(updateTodayInfo, 1000);

    renderSchedule();
};

function setPoolCapacity() {
    const val = parseInt(document.getElementById('poolCapacity').value, 10);
    if (isNaN(val) || val <= 0) {
        alert('请输入大于0的数字作为容量！');
        return;
    }
    poolCapacity = val;
    saveData();
    renderTaskPool();
}