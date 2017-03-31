

var google = google || {};
google.project = google.project || {};
google.project.brainstorming = google.project.brainstorming || {};
//google.project.brainstorming.ROOT = 'https://aiesecapi.appspot.com/_ah/api';
google.project.brainstorming.ROOT = 'http://localhost:9080/_ah/api';

var app = angular.module("bstormingapp", ["ngMaterial", "firebase", "ui.router", "googlechart"]);


'use strict';
function init() {
    angular.element(document).ready(function () {
         window.init();
    });
}

app.factory("appFactory", ["Auth", function (Auth) {
    return a = {
        setToken: function () {
            var token = Auth.$getAuth().getToken(false).then(function(idToken) {
                gapi.auth.setToken({ access_token: idToken });
            }, function (error) {
                return error;
            });
            return token;
        },
        getTimeZone: function () {
            var offset = new Date().getTimezoneOffset();
            return offset;
        },
        getExpenses: function (data) {
            var result = {};
            var exps = [];
            var catTotals = []
            var i = 0;
            var ct = {};
            ct.cols = [
                {id: "c", label: "Category", type: "string"},
                {id: "t", label: "Total", type: "number"}
            ];
            return a.setToken().then(function () {
                 return gapi.client.bstormingapi.getMonthExpenses(data);
            }).then(function (resp) {
                angular.forEach(resp.result.items, function (item) {
                    exps.unshift(item);
                });
                ct.rows = []
                angular.forEach(resp.result.catTotals, function (item) {
                    catTotals.unshift(item);
                    ct.rows[i] = { c : [
                        {v: item.category},
                        {v: item.total}
                    ]}
                    i++;
                });
                result = { 'exps': exps, 'catTotals': catTotals, 'monthTotal': resp.result.exps_sum, 'month': resp.result.month, 'ct': ct };
                return result;
            });
        },
        updateChart: function (chartDataObject, exp, wasAdded) {
            var i = 0;
            var catChartAdded = false;     
            angular.forEach(chartDataObject.data.rows, function (row) {
                if (row.c[0].v == exp.category) {
                    if (wasAdded)
                        chartDataObject.data.rows[i].c[1].v = row.c[1].v + exp.quantity;
                    else
                        chartDataObject.data.rows[i].c[1].v = row.c[1].v - exp.quantity;
                    catChartAdded = true;
                }
                i++;
            });
            if (!catChartAdded) {
                chartDataObject.data.rows[i] = {
                    c: [
                         { v: exp.category },
                         { v: exp.quantity }
                    ]
                }
            };

            return chartDataObject;
        },
        updateExpensesTable: function (catTotals, exp, wasAdded) {       
            var j = 0;
            var catAdded = false;
            var shouldDelete = false;
            angular.forEach(catTotals, function (item) {
                if (item.category == exp.category) {
                    if (wasAdded)
                        catTotals[j].total = item.total + exp.quantity;
                    else {
                        catTotals[j].total = item.total - exp.quantity;
                        if (catTotals[j].total == 0) {
                            catTotals = catTotals.filter(function (el) {
                                return el.category !== exp.category;
                            });
                        }
                    }
                    catAdded = true;
                }
                j++;
            });
            if (!catAdded) {
                category = {};
                category.category = exp.category
                category.total = exp.quantity;
                category.categoryUrl = exp.categoryUrl;
                catTotals.unshift(category);
            }

            return catTotals;
        }
    }
}]);

app.controller("mainCtrl", ["$scope", "Auth", "$window", "$state",
    function ($scope, Auth, $window, $state) {      
        $scope.auth = Auth;
        $window.init = function(){
            $scope.$apply(function () {
                gapi.client.load('bstormingapi', 'v1', function () {
                    $scope.is_backend_ready = true;
                    $scope.auth.$onAuthStateChanged($scope.onAuthStateChanged);
                }, google.project.brainstorming.ROOT);
            });
        };

        $scope.onAuthStateChanged = function (firebaseUser) {
            if (firebaseUser == null){
                $state.go('login');
            }
            else {
                $state.go('home');
            }
        };

        $scope.signIn = function(){
            $scope.auth.$signInWithPopup('facebook');
        };
    }
]);

app.run(["$rootScope", "$state", "Auth", function ($rootScope, $state, Auth) {
  $rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
    // We can catch the error thrown when the $requireSignIn promise is rejected
      // and redirect the user back to the home page
    if (error === "AUTH_REQUIRED") {
        $state.go("login");
    }
  });
}]);

app.config(["$stateProvider", "$mdDateLocaleProvider", function ($stateProvider, $mdDateLocaleProvider, appFactory) {

    $mdDateLocaleProvider.formatDate = function (date) {
        return date == null ? null : moment(date).format('DD-MM-YYYY');
    };

    //$mdDateLocaleProvider.months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio','julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    //$mdDateLocaleProvider.shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    //$mdDateLocaleProvider.days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    //$mdDateLocaleProvider.shortDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
  $stateProvider
    .state("login", {
      templateUrl: "partials/login.html"
    })
    .state("home", {
      controller: "homeCtrl",
      templateUrl: "partials/home.html",
      resolve: {
        // controller will not be loaded until $requireSignIn resolves
          "currentAuth": ["Auth", "appFactory", function (Auth, appFactory) {
          // $requireSignIn returns a promise so the resolve waits for it to complete
          // If the promise is rejected, it will throw a $stateChangeError
              //return Auth.$requireSignIn();
              return appFactory.setToken().then(function () {
                  return gapi.client.bstormingapi.user.insert()
              }).then(function (response) {
                  return Auth.$requireSignIn();
              }, function (error) {
                  // the user is logged in firebase but not in gae, so we return a null to signout from firebase. 
                  return null; 
              });
        }]
      }
    });
}]);

app.controller("homeCtrl", ["currentAuth", "$scope", "Auth", "$state", "appFactory", "$http", "$mdToast", "$mdDialog", function (currentAuth, $scope, Auth, $state, appFactory, $http, $mdToast, $mdDialog) {
  // currentAuth (provided by resolve) will contain the
    // authenticated user or null if not signed in   
    if (currentAuth == null) {
        Auth.$signOut();
        return;
    }
    $scope.isNormalDate = true;
    $scope.month = null;
    $scope.displayDate = null;
    $scope.expDate = null;
    $scope.selectedItem;
    $scope.categories = ['Ropa', 'Comidas fuera', 'Automovil', 'Abarrotes', 'Entretenimiento', 'Servicios', 'Educaci\u00F3n', 'Gastos m\u00E9dicos', 'Otros'];
    $scope.items = [];
    $scope.catTotals = [];
    $scope.isChartReady = false;
    $scope.noExpenses = false;
    $scope.chartData = []
    $scope.exps_sum = 0;
    $scope.months = [];
    $scope.myChartObject = {};
    $scope.myChartObject.type = "PieChart";
    $scope.myChartObject.options = {
        'title': 'Gastos por categoria'
    };

    var el = angular.element(document.getElementById('toast-container'));
    var toast = $mdToast.simple()
        .textContent('Ups algo salio mal :(')
        .hideDelay(3000)
        .position('bottom left')
        .parent(el);

    $scope.deleteExpense = function (ev, websafeKey, index) {

        var confirm = $mdDialog.confirm()
         .title('Eliminar gasto')
         .textContent('Este gasto ser\u00E1 eliminado definitivamente y ya no podr\u00E1s encontrarlo')
         .ariaLabel('Lucky day')
         .targetEvent(ev)
         .ok('Eliminar gasto')
         .cancel('Cancelar');

        $mdDialog.show(confirm).then(function () {
            $scope.websafeKey = websafeKey;
            appFactory.setToken().then(function () {
                return gapi.client.bstormingapi.deleteExp({ 'websafeKey': websafeKey });
            }).then(function (response) {
                $scope.$apply(function () {
                    var removedItem = $scope.items.splice(index, 1);
                    $scope.myChartObject = appFactory.updateChart($scope.myChartObject, removedItem[0], false);
                    $scope.catTotals = appFactory.updateExpensesTable($scope.catTotals, removedItem[0], false);
                    $scope.exps_sum = parseFloat($scope.exps_sum) - parseFloat(removedItem[0].quantity);
                    $scope.websafeKey = false;
                });
            }, function (error) {
                $scope.websafeKey = false;
                $mdToast.show(toast);
            });      
        }, function () {
            $scope.status = 'You decided to keep your debt.';
        });
    };

    $scope.dateRange = function () {
        $scope.isNormalDate = false;
        $scope.isRangeDate = true;
        $scope.noExpenses = false;
        $scope.isTableReady = false;
        $scope.exps_sum = 0;
        $scope.month = null;
        $scope.items = [];
        $scope.catTotals = [];
        $scope.isChartReady = false;
        $scope.initialDate = null;
        $scope.endDate = null;
    }

    $scope.getExpByDateRange = function () {
        data = {};
        data.start = $scope.initialDate;
        data.end = $scope.endDate;
        console.log(data);
        $scope.getExpenses(data, false);
    }

    $scope.loadMonths = function () {
        gapi.client.bstormingapi.getMonths().then(function (resp) {
            $scope.$apply(
                function () {
                    angular.forEach(resp.result.months, function (month) {
                        $scope.months.push(month);
                    });
                });
        });
    }


    $scope.getExpenses = function (data, isNormalDate) {
        $scope.noExpenses = false;
        $scope.isLoading = true;
        $scope.isTableReady = false;
        $scope.exps_sum = 0;
        $scope.month = null;
        $scope.items = [];
        $scope.catTotals = [];
        $scope.isChartReady = false;
        $scope.isNormalDate = isNormalDate;
        $scope.isRangeDate = !isNormalDate;
        $scope.expDate = null;
        $scope.minDate = null;
        $scope.maxDate = null;
        appFactory.getExpenses(data).then(function(response){
            $scope.$apply(
                function () {
                    $scope.isLoading = false;
                    if (response.exps.length == 0)
                        $scope.noExpenses = true;
                    else {
                        $scope.items = response.exps;
                        $scope.isTableReady = true;
                    }
                    $scope.catTotals = response.catTotals;
                    $scope.exps_sum = response.monthTotal;
                    $scope.month = response.month;
                });
            return response.ct;
        }).then(function (resp) {
            if (resp.rows.length != 0) {
                $scope.isChartReady = true;
                $scope.myChartObject.data = resp;
            }

        }, function (err) {
            $scope.isLoading = false;
            $mdToast.show(toast);
        })
    }

    $scope.init = function () {    
        $scope.getExpenses(null, true);
    };//init

    $scope.getTodayExpenses = function () {
        data = { 'isToday': true }
        $scope.getExpenses(data, true);
    }

    $scope.getExByMont = function (strDate, minDate, maxDate) { 
        date = new Date(strDate);
        data = {'date' : date}
        $scope.displayDate = date;
        $scope.minDate = new Date(minDate);
        $scope.maxDate = new Date(maxDate);
        $scope.getExpenses(data, true);
    }//getExByMonth
 
    currentAuth.providerData.forEach(function (provider) {
        $http.get("https://graph.facebook.com/" + provider.uid + "/picture?redirect=false&height=64&width=64").then(function (resp) {
            $scope.picture = resp.data.data.url;
        });
    });

    $scope.auth = Auth;
    $scope.name = currentAuth.displayName;
    $scope.signOut = function () {
            gapi.auth.setToken({ access_token: '' })
            $scope.auth.$signOut();
    };

    $scope.createIdea = function () {
      
        idea = {
            "description": $scope.description,
            "quantity": $scope.quantity,
            "category": $scope.selectedItem,
            "created": $scope.expDate == null ? $scope.expDate : $scope.expDate.toISOString()
        }
        $scope.isPosting = true;
        appFactory.setToken().then(function () {
            return gapi.client.bstormingapi.expense.insert(idea);
        }).then(function (resp) {
            $scope.$apply(
                    function () {
                        $scope.description = null;
                        $scope.quantity = null;
                        $scope.selectedItem = null;
                        $scope.expDate = null;
                        $scope.isPosting = false;
                        $scope.noExpenses = false;
                        var created = new Date(parseInt(resp.result.created))
                        var currentMonth = $scope.displayDate != null ? $scope.displayDate.getMonth() : null;       
                        if (currentMonth == null || created.getMonth() == currentMonth) {                            
                            $scope.items.unshift(resp.result);                         
                            $scope.myChartObject = appFactory.updateChart($scope.myChartObject, resp.result, true);
                            $scope.catTotals = appFactory.updateExpensesTable($scope.catTotals, resp.result, true);
                            $scope.exps_sum = parseFloat($scope.exps_sum) + parseFloat(resp.result.quantity);
                        }
                    }//apply
                );
        }, function (error) {
            $scope.isPosting = false;
            $mdToast.show(toast);
        });
    }

    $scope.dropboxitemselected = function (item) {
        $scope.selectedItem = item;
    }
}]);

app.factory("Auth", ["$firebaseAuth",
  function($firebaseAuth) {
    return $firebaseAuth();
  }
]);