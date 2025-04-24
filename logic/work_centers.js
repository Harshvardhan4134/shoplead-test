document.addEventListener("DOMContentLoaded", function () {
    const workCentersContainer = document.getElementById("workCentersContainer");

    // ✅ Event delegation to handle dynamic elements
    workCentersContainer.addEventListener("click", function (event) {
        if (event.target.classList.contains("clickable")) {
            const workCenter = event.target.getAttribute("data-center");
            const type = event.target.getAttribute("data-type");
            openWorkCenterModal(workCenter, type);
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const workCentersContainer = document.getElementById('workCentersContainer');
    const modalWorkCenterTitle = document.getElementById('modalWorkCenterTitle');
    const modalJobsTable = document.getElementById('modalJobsTable');
    const modalOperationsContainer = document.getElementById('modalOperationsContainer');
    const modalOperationsTable = document.getElementById('modalOperationsTable');

    function loadWorkCenters() {
        console.log("🔄 Fetching work center data...");

        fetch('/api/work_centers')
            .then(response => response.json())
            .then(data => {
                console.log("✅ Received Work Centers Data:", data);
                workCentersContainer.innerHTML = ''; // Clear previous content

                if (Object.keys(data).length === 0) {
                    console.warn("⚠ No work centers data available!");
                    workCentersContainer.innerHTML = '<div class="alert alert-warning">No work center data available.</div>';
                    return;
                }

                Object.entries(data).forEach(([workCenter, metrics]) => {
                    console.log(`📊 Processing Work Center: ${workCenter}`, metrics);

                    // ✅ Extracting values for display
                    const availableWorkHours = metrics.available_work_hours ?? 0;
                    const backlogHours = metrics.backlog_hours ?? 0;
                    const inProgressHours = metrics.in_progress_hours ?? 0;
                    const efficiency = metrics.efficiency ?? "N/A";
                    const historicalEfficiency = metrics.historical_efficiency ?? "N/A";
                    const utilizationRate = metrics.utilization_rate ?? "N/A";
                    const remainingHours = metrics.remaining_hours ?? 0;
                    const totalJobs = metrics.total_jobs ?? 0;
                    const totalOperations = metrics.total_operations ?? 0;
                    const avgHoursPerJob = metrics.avg_hours_per_job ?? "N/A";
                    const peakLoad = metrics.peak_load ? "⚠ High Load" : "✅ Normal Load";

                    // ✅ Ensure work center cards are properly structured
                    const workCenterCard = document.createElement('div');
                    workCenterCard.className = 'col-md-4 mb-4';
                    workCenterCard.innerHTML = `
                        <div class="card h-100">
                            <div class="card-header d-flex justify-content-between">
                                <h5 class="mb-0">${workCenter}</h5>
                                <span class="badge ${peakLoad === "⚠ High Load" ? "bg-danger" : "bg-success"}">${peakLoad}</span>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-4">
                                        <p class="text-muted mb-1">Available Work (Hrs)</p>
                                        <h4 class="clickable text-primary" data-type="available" data-center="${workCenter}">${availableWorkHours.toFixed(2)}</h4>
                                    </div>
                                    <div class="col-4">
                                        <p class="text-muted mb-1">Backlog (Hrs)</p>
                                        <h4 class="clickable text-danger" data-type="backlog" data-center="${workCenter}">${backlogHours.toFixed(2)}</h4>
                                    </div>
                                    <div class="col-4">
                                        <p class="text-muted mb-1">In Progress (Hrs)</p>
                                        <h4 class="clickable text-warning" data-type="in_progress" data-center="${workCenter}">${inProgressHours.toFixed(2)}</h4>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-6">
                                        <p class="text-muted mb-1">Remaining Hours</p>
                                        <h4>${remainingHours.toFixed(2)}</h4>
                                    </div>
                                    <div class="col-6">
                                        <p class="text-muted mb-1">Total Jobs</p>
                                        <h4>${totalJobs}</h4>
                                    </div>
                                </div>
                                <button class="btn btn-primary w-100 mt-3" onclick="openWorkCenterDetails('${workCenter}')">
                                    View Details
                                </button>
                            </div>
                        </div>
                    `;

                    workCentersContainer.appendChild(workCenterCard);
                });

                // Attach click events to available work, backlog, and in-progress fields
                document.querySelectorAll('.clickable').forEach(item => {
                    item.addEventListener('click', function () {
                        const workCenter = this.getAttribute('data-center');
                        const type = this.getAttribute('data-type');
                        openWorkCenterModal(workCenter, type);
                    });
                });
            })
            .catch(error => {
                console.error("❌ Error fetching work center data:", error);
                workCentersContainer.innerHTML = '<div class="alert alert-danger">Error loading work centers data</div>';
            });
    }
    function openWorkCenterModal(workCenter, type) {
        console.log(`📋 Opening modal for ${workCenter} - ${type}`);
    
        const formattedType = type.replace("_", " ").toUpperCase();
        modalWorkCenterTitle.textContent = `${workCenter} - ${formattedType}`;
    
        modalJobsTable.innerHTML = ""; // Reset job list
        modalOperationsContainer.classList.add("d-none"); // Hide operations section
        modalOperationsTable.innerHTML = ""; // Reset operations
    
        fetch(`/api/work_center_details?center=${workCenter}&type=${type}`)
            .then((response) => response.json())
            .then((data) => {
                console.log(`📋 Loaded Jobs for ${workCenter} - ${type}:`, data);
    
                if (!data.jobs || data.jobs.length === 0) {
                    modalJobsTable.innerHTML =
                        '<tr><td colspan="4" class="text-center">No jobs found</td></tr>';
                } else {
                    modalJobsTable.innerHTML = data.jobs
                        .map(
                            (job) => `
                            <tr class="clickable job-row" data-job="${job.job_number}" data-center="${workCenter}" data-type="${type}">
                                <td>${job.job_number}</td>
                                <td>${job.customer}</td>
                                <td>${job.reference}</td>
                                <td class="total-hours">${job.total_hours.toFixed(2)} hrs</td>
                            </tr>`
                        )
                        .join("");
                }
    
                // ✅ Attach click events to job rows dynamically
                document.querySelectorAll(".job-row").forEach((item) => {
                    item.addEventListener("click", function () {
                        const jobNumber = this.getAttribute("data-job");
                        openJobDetails(jobNumber, workCenter, type);
                    });
                });
    
                const modal = new bootstrap.Modal(
                    document.getElementById("workCenterDetailModal")
                );
                modal.show();
            })
            .catch((error) => console.error("❌ Error fetching work center details:", error));
    }
    
    
    function openJobDetails(jobNumber, workCenter, type) {
        console.log(`📋 Loading operations for Job ${jobNumber} in ${workCenter}`);
    
        modalOperationsTable.innerHTML = ""; // Reset operations
        modalOperationsContainer.classList.remove("d-none"); // Show operations section
    
        // ✅ Remove previous highlight from all rows
        document.querySelectorAll(".job-row").forEach(row => {
            row.classList.remove("selected");
        });
    
        // ✅ Highlight the selected row
        const selectedRow = document.querySelector(`.job-row[data-job='${jobNumber}']`);
        if (selectedRow) {
            selectedRow.classList.add("selected");
        }
    
        fetch(`/api/job_operations?job=${jobNumber}&center=${workCenter}&type=${type}`)
            .then((response) => response.json())
            .then((data) => {
                console.log(`📋 Loaded Operations for Job ${jobNumber}:`, data);
    
                if (!data.operations || data.operations.length === 0) {
                    modalOperationsTable.innerHTML =
                        '<tr><td colspan="8" class="text-center">No operations found</td></tr>';
                } else {
                    modalOperationsTable.innerHTML = data.operations
                        .map(
                            (op) => `
                            <tr>
                                <td>${op.part_name}</td>
                                <td>${op.work_order_number}</td>
                                <td>${op.operation_number}</td>
                                <td>${op.task_description}</td>
                                <td>${op.remaining_work.toFixed(2)}</td>
                                <td>${op.planned_hours.toFixed(2)}</td>
                                <td>${op.actual_hours.toFixed(2)}</td>
                                <td>${op.status}</td>
                            </tr>`
                        )
                        .join("");
                }
            })
            .catch((error) => console.error("❌ Error fetching job operations:", error));
    }
    
    
    
    

    function getColorClass(efficiency) {
        const effValue = parseInt(efficiency);
        if (effValue >= 80) return 'bg-success';
        if (effValue >= 60) return 'bg-warning';
        return 'bg-danger';
    }


    // Initial Load
    loadWorkCenters();

    // Refresh every 5 minutes
    setInterval(loadWorkCenters, 300000);
});
