var Path = (function ($, Data, Log, Network) {
    var exports = {};

    // Data objects here: array of L.LatLng objects
    var waypoints = [];

    // Interactive map objects here
    var map;
    
    // Initialize map if necessary
    $(document).ready(function () {
        if (!map) {
            map = L.map('map').setView([43.53086, -80.5772], 17);
            map.attributionControl.setPrefix(false);

            L.tileLayer('sat_tiles/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(map);
        }
    });

    // Handle button clicks
    $(document).ready(function () {

        $('#lockOn').on('click', function () {
            // TODO Decouple this from plane marker & figure out somewhere to store last "sensible GPS coordinates"
            // (to prevent bug with erroneous GPS coordinates crashing Leaflet)
            if (planeMarker) {
                map.panTo(planeMarker.getLatLng());
            }
        });

        $('#sendWaypoints').on('click', function () {
            for (i = 0; i < waypoints.length; i++) {
                var latLng = waypoints[i];
                command = "new_Waypoint:" + latLng.lat + "," + latLng.lng + "\r\n";
                Network.write(command);
            }
        });

        $('#clearWaypoints').on('click', function () {
            waypoints = [];
            waypointPlotter.setLatLngs(waypoints);  // BUG Plotter internal state is not correctly updated after setLatLngs
            redrawMap();
        });
    });

    var planeIcon;
    var planeHollowIcon;
    var planeMarker;
    var gpsFixMessagebox;
    var waypointMarkerGroup;
    var waypointPlotter;
    var historyPolyline;

    Network.on('data', redrawMap);

    function redrawMap() {

        // Check for GPS fix, assuming we'll never fly off the coast of West Africa
        // (No GPS fix if coordinates close to (0; 0) or impossibly big)
        var gpsFix = (Math.abs(lat) > 1) && (Math.abs(lon) > 1) && (Math.abs(lat) < 360) && (Math.abs(lon) < 360);

        lat = parseFloat(Data.state.lat);
        lon = parseFloat(Data.state.lon);
        heading = Data.state.heading;
        yaw = Data.state.yaw;

        // Init icons for planeMarker if necessary
        if (!planeIcon) {
            planeIcon = L.icon({
                iconUrl: 'plane.png',
                iconSize: [30, 30],
            });
        }
        if (!planeHollowIcon) {
            planeHollowIcon = L.icon({
                iconUrl: 'plane-hollow.png',
                iconSize: [30, 30],
                title: 'No GPS fix',
            });
        }

        // Init planeMarker if necessary
        if (!planeMarker) {
            planeMarker = new L.RotatedMarker([lat, lon], {
                icon: planeIcon,
            }).addTo(map);
        }

        // Init messagebox about GPS fix
        if (!gpsFixMessagebox) {
            gpsFixMessagebox = L.control.messagebox({
                timeout: null,
                className: 'messagebox-gpsfix',
            }).addTo(map);
        }

        // Init waypoint marker layer-group if necessary
        if (!waypointMarkerGroup) {
            waypointMarkerGroup = L.layerGroup().addTo(map);
        }

        // Init waypointPlotter if necessary
        if (!waypointPlotter) {
            waypointPlotter = L.Polyline.Plotter(waypoints, {
                color: 'red',
                weight: 5,
                opacity: 0.5,
            }).addTo(map);

            waypointPlotter.on('change', function(e) {
                console.log('waypoint polyline change', e.target.getLatLngs().map(function(a){return a+'';}));
            });
        }

        // Init historyPolyline if necessary
        if (!historyPolyline) {
            historyPolyline = new L.Polyline([], {
                color: '#0000ff',
                weight: 5,
                clickable: false,
            }).addTo(map);
        }


        // Update plane marker
        if (gpsFix) {
            planeMarker.setIcon(planeIcon);
            planeMarker.setLatLng(new L.LatLng(lat, lon));
            planeMarker._icon.title = lat + "°, " + lon + "°\nyaw " + Math.round(yaw) + "°, hdg " + heading + "°";
            planeMarker.options.angle = yaw;
            planeMarker.update();
        } else {
            planeMarker.setIcon(planeHollowIcon);
        }

        // Update gpsFix message box
        if (gpsFix) {
            gpsFixMessagebox.hide();
        } else {
            gpsFixMessagebox.show('No GPS fix');
        }

        // Draw points on historyPolyline
        if (gpsFix) {
            historyPolyline.addLatLng(L.latLng(lat, lon));
        }
    }

    // Export what needs to be
    return exports;

})($, Data, Log, Network);