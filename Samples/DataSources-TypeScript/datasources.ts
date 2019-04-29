'use strict';
// Unfortunately, we have not type definitions available for the extension api and must declare it as any.
declare var tableau: any;

// Wrap everything in an anonymous function to avoid polluting the global namespace
(async () => {
  class DataSourceExtension {
    // Avoid the use of globals.
    constructor(private _$: JQueryStatic) {}

    /**
     * Refreshes the given dataSource
     * @param dataSource
     */
    private static async refreshDataSource(dataSource) {
      await dataSource.refreshAsync();
      console.log(dataSource.name + ': Refreshed Successfully');
    }

    /**
     * Initializes the extension
     */
    public async initialize() {
      console.log('Waiting for document ready');
      await $.ready;
      console.log('Initializing extension API');
      await tableau.extensions.initializeAsync();
      // Since dataSource info is attached to the worksheet, we will perform
      // one async call per worksheet to get every dataSource used in this
      // dashboard.  This demonstrates the use of Promise.all to combine
      // promises together and wait for each of them to resolve.
      const dataSourceFetchPromises = [];

      // Maps dataSource id to dataSource so we can keep track of unique dataSources.
      const dashboardDataSources = {};

      // To get dataSource info, first get the dashboard.
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      // Then loop through each worksheet and get its dataSources, save promise for later.
      dashboard.worksheets.forEach(worksheet => dataSourceFetchPromises.push(worksheet.getDataSourcesAsync()));
      const fetchResults = await Promise.all(dataSourceFetchPromises);
      fetchResults.forEach(dataSourcesForWorksheet =>
        dataSourcesForWorksheet.forEach(dataSource => {
          if (!dashboardDataSources[dataSource.id]) {
            // We've already seen it, skip it.
            dashboardDataSources[dataSource.id] = dataSource;
          }
        })
      );

      this.buildDataSourcesTable(dashboardDataSources);

      // This just modifies the UI by removing the loading banner and showing the dataSources table.
      this._$('#loading').addClass('hidden');
      this._$('#dataSourcesTable')
        .removeClass('hidden')
        .addClass('show');
    }

    private setConnectionsDetail(connectionSummaries) {
      // Loop through each connection summary and list the connection's
      // name and type in the info field
      let connectionsStr = '';
      connectionSummaries.forEach(summary => (connectionsStr += summary.name + ': ' + summary.type + ', '));

      // Slice of the last ', ' for formatting.
      this._$('#connectionsDetail').text(connectionsStr.slice(0, -2));
    }

    private setActiveTablesDetail(activeTables) {
      // Loop through each table that was used in creating this datasource
      let tableStr = '';
      activeTables.forEach(table => (tableStr += table.name + ', '));

      // Slice of the last ', ' for formatting.
      this._$('#activeTablesDetail').text(tableStr.slice(0, -2));
    }

    /**
     * Displays a modal dialog with more details about the given dataSource.
     * @param dataSource
     */
    private showModal(dataSource) {
      const modal = this._$('#infoModal');

      this._$('#nameDetail').text(dataSource.name);
      this._$('#idDetail').text(dataSource.id);
      this._$('#typeDetail').text(dataSource.isExtract ? 'Extract' : 'Live');

      // Loop through every field in the dataSource and concat it to a string.
      let fieldNamesStr = '';
      dataSource.fields.forEach(field => (fieldNamesStr += field.name + ', '));

      // Slice off the last ', ' for formatting.
      this._$('#fieldsDetail').text(fieldNamesStr.slice(0, -2));

      // Arrow functions are used instead of method references so that the `this` context is preserved inside
      // the called methods.
      dataSource
        .getConnectionSummariesAsync()
        .then(connectionSummaries => this.setConnectionsDetail(connectionSummaries));
      dataSource.getActiveTablesAsync().then(activeTables => this.setActiveTablesDetail(activeTables));

      // @ts-ignore
      modal.modal('show');
    }

    /**
     * Constructs UI that displays all the dataSources in this dashboard
     * given a mapping from dataSourceId to dataSource objects.
     * @param dataSources
     */
    private buildDataSourcesTable(dataSources) {
      // Clear the table first.
      this._$('#dataSourcesTable > tbody tr').remove();
      const dataSourcesTable = this._$('#dataSourcesTable > tbody')[0];

      // Add an entry to the dataSources table for each dataSource.
      for (const dataSource of (Object as any).values(dataSources)) {
        // @ts-ignore
        const newRow = dataSourcesTable.insertRow(dataSourcesTable.rows.length);
        const nameCell = newRow.insertCell(0);
        const refreshCell = newRow.insertCell(1);
        const infoCell = newRow.insertCell(2);

        const refreshButton = document.createElement('button');
        refreshButton.innerHTML = 'Refresh Now';
        refreshButton.type = 'button';
        refreshButton.className = 'btn btn-primary';
        refreshButton.addEventListener('click', () => DataSourceExtension.refreshDataSource(dataSource));

        const infoSpan = document.createElement('span');
        infoSpan.className = 'glyphicon glyphicon-info-sign';
        infoSpan.addEventListener('click', () => this.showModal(dataSource));

        nameCell.innerHTML = dataSource.name;
        refreshCell.appendChild(refreshButton);
        infoCell.appendChild(infoSpan);
      }
    }
  }

  console.log('Initializing extension.');
  await new DataSourceExtension($).initialize();
})();
