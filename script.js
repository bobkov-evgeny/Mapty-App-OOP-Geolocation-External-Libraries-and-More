'use strict';

const form = document.querySelector('.form');
let inputs = [];
let btnEdit = [];
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
   date = new Date();
   id = (Date.now() + '').slice(-10);
   clicks = 0;

   constructor(coords, distance, duration) {
      this.coords = coords; // [lat, lng]
      this.distance = distance; // in km
      this.duration = duration; // in min
   }

   _setDescription() {
      // prettier-ignore
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      this.description = `${this.type[0].toUpperCase()}${this.type.slice(
         1
      )} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
   }

   click() {
      this.clicks++;
   }
}

class Running extends Workout {
   type = `running`;

   constructor(coords, distance, duration, cadence) {
      super(coords, distance, duration);
      this.cadence = cadence;
      this.calcPace();
      this._setDescription();
   }

   calcPace() {
      //min per km
      this.pace = this.duration / this.distance;
      return this.pace;
   }
}

class Cycling extends Workout {
   type = `cycling`;

   constructor(coords, distance, duration, elevationGain) {
      super(coords, distance, duration);
      this.elevationGain = elevationGain;
      this.calcSpeed();
      this._setDescription();
   }

   calcSpeed() {
      // km per hour
      this.speed = this.distance / (this.duration / 60);
      return this.speed;
   }
}

/////////////////////////////////////////////////////////
// Application architecture
class App {
   #map;
   #mapZoomLevel = 14;
   #mapEvent;
   #workouts = [];

   constructor() {
      // get user position
      this._getPosition();

      // get data from local storage
      this._getLocalStorage();

      // Attach event handlers
      form.addEventListener('submit', this._newWorkout.bind(this));
      inputType.addEventListener('change', this._toggleElevationField);
      containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
      containerWorkouts.addEventListener(
         'click',
         this._deleteWorkout.bind(this)
      );

      // Implementing edit function
      //prettier-ignore
      setTimeout(() => {btnEdit = document.querySelectorAll('.btn-edit');}, 1000);
      //prettier-ignore
      setTimeout(() => btnEdit.forEach(btn => btn.addEventListener('click', this._editWork.bind(this))),1000);
   }

   _editWork(e) {
      const curWorkoutId = e.target.closest('.workout').id;
      const curWorkout = this.#workouts.find(x => x.id === curWorkoutId);
      const duration = document.getElementById(`${curWorkoutId + 2}`);
      const distance = document.getElementById(`${curWorkoutId + 1}`);

      if (curWorkout.type === 'running') {
         const cadence = document.getElementById(`${curWorkoutId + 3}`);
         curWorkout.cadence = +cadence.value;
      }
      if (curWorkout.type === 'cycling') {
         const elevationGain = document.getElementById(`${curWorkoutId + 4}`);
         curWorkout.elevationGain = +elevationGain.value;
      }

      curWorkout.distance = +distance.value;
      curWorkout.duration = +duration.value;
      localStorage.setItem('workouts', JSON.stringify(this.#workouts));
      location.reload();
   }

   _getPosition() {
      if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(
            this._loadMap.bind(this),
            function () {
               alert('Could not get your position');
            }
         );
      }
   }

   _loadMap(position) {
      const { latitude } = position.coords;
      const { longitude } = position.coords;
      const coords = [latitude, longitude];

      this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

      L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
         attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`,
      }).addTo(this.#map);

      // Click on map
      this.#map.on('click', this._showForm.bind(this));

      // render markers
      this.#workouts.forEach(work => {
         this._renderWorkoutMarker(work);
      });
   }

   _showForm(mapE) {
      this.#mapEvent = mapE;
      form.classList.remove('hidden');
      inputDistance.focus();
   }

   _hideForm() {
      // Empty inputs
      inputDistance.value =
         inputDuration.value =
         inputCadence.value =
         inputElevation.value =
            '';
      form.style.display = 'none';
      form.classList.add('hidden');
      setTimeout(() => (form.style.display = 'grid'), 1000);
   }

   _toggleElevationField() {
      inputElevation
         .closest('.form__row')
         .classList.toggle('form__row--hidden');
      inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
   }

   _newWorkout(e) {
      // every возвращает -true- если все элементы являются валидными
      const validInputs = (...inputs) =>
         inputs.every(input => Number.isFinite(input));
      const allPositive = (...inputs) => inputs.every(input => input > 0);

      e.preventDefault();

      // Получить значения из формы ввода
      const type = inputType.value;
      const distance = +inputDistance.value;
      const duration = +inputDuration.value;
      const { lat, lng } = this.#mapEvent.latlng;
      let workout;

      // Если БЕГ, то создать обьект Running
      if (type === 'running') {
         const cadence = +inputCadence.value;

         // Проверка данных на корректность
         if (
            !validInputs(distance, duration, cadence) ||
            !allPositive(distance, duration, cadence)
         )
            return alert('Inputs have to be positive numbers!');

         workout = new Running([lat, lng], distance, duration, cadence);
      }

      // Если Велосипед, то создать обьект Cycling
      if (type === 'cycling') {
         const elevationGain = +inputElevation.value;

         // Проверка данных на корректность
         if (
            !validInputs(distance, duration, elevationGain) ||
            !allPositive(distance, duration)
         )
            return alert('Inputs have to be positive numbers!');

         workout = new Cycling([lat, lng], distance, duration, elevationGain);
      }

      // add new object to workout array
      this.#workouts.push(workout);

      // render workout on map as marker
      this._renderWorkoutMarker(workout);

      // render workout on list
      this._renderWorkout(workout);

      // hide form + clear input
      this._hideForm();

      // Set local storage to all workouts
      this._setLocalStorage();
   }

   _renderWorkoutMarker(workout) {
      L.marker(workout.coords)
         .addTo(this.#map)
         .bindPopup(
            L.popup({
               maxWidth: 250,
               minWidth: 100,
               autoClose: false,
               closeOnClick: false,
               className: `${workout.type}-popup`,
            })
         )
         .setPopupContent(
            `${workout.type === 'running' ? `🏃‍♂️` : `🚴‍♀️`} ${workout.description}`
         )
         .openPopup();
   }

   _renderWorkout(workout) {
      let html = `
		<li class="workout workout--${workout.type}" id="${workout.id}">
			<div class="workout__title-container">
            <h2 class="workout__title">${workout.description}</h2>
            <div class="btn--wrapper">
               <button class="btn-edit">Save new data</button>
               <button class="btn-delete">Delete</button>
            </div>
         </div>
			<div class="workout__details--wrapper">
				<div class="workout__details">
					<span class="workout__icon">${workout.type === 'running' ? `🏃‍♂️` : `🚴‍♀️`}</span>
					<input class="detail--input distance--input" id="${workout.id + 1}" value="${
         workout.distance
      }"</input>
					<span class="workout__unit">km</span>
				</div>
				<div class="workout__details">
					<span class="workout__icon">⏱</span>
					<input class="detail--input duration--input" id="${workout.id + 2}" value="${
         workout.duration
      }"</input>
					<span class="workout__unit">min</span>
				</div>`;
      if (workout.type === 'running') {
         html += `
					<div class="workout__details">
						<span class="workout__icon">⚡️</span>
						<input readonly class="detail--input disabled-input" value="${workout.pace.toFixed(
                     1
                  )}"</input>
						<span class="workout__unit">min/km</span>
					</div>
					<div class="workout__details">
						<span class="workout__icon">🦶🏼</span>
						<input class="detail--input cadence--input" id="${workout.id + 3}" value="${
            workout.cadence
         }"</input>
						<span class="workout__unit">spm</span>
					</div>
				</div>
         </li>`;
      }

      if (workout.type === 'cycling') {
         html += `
				<div class="workout__details">
					<span class="workout__icon">⚡️</span>
					<input readonly class="detail--input disabled-input" value="${workout.speed.toFixed(
                  1
               )}"</input>
					<span class="workout__unit">km/h</span>
				</div>
				<div class="workout__details">
					<span class="workout__icon">⛰</span>
					<input class="detail--input elevationGain--input" id="${
                  workout.id + 4
               }" value="${workout.elevationGain}"</input>
					<span class="workout__unit">m</span>
				</div>
         </li>
			`;
      }

      form.insertAdjacentHTML('afterend', html);
   }

   _moveToPopup(e) {
      const workoutEl = e.target.closest('.workout');

      if (!workoutEl) return;
      const workout = this.#workouts.find(work => work.id === workoutEl.id);

      this.#map.setView(workout.coords, this.#mapZoomLevel, {
         animate: true,
         pan: { duration: 1 },
      });

      //workout.click();
   }

   _setLocalStorage() {
      localStorage.setItem('workouts', JSON.stringify(this.#workouts));
   }

   _getLocalStorage() {
      const data = JSON.parse(localStorage.getItem('workouts'));

      if (!data) return;

      this.#workouts = data;
      this.#workouts.forEach(work => this._renderWorkout(work));
   }

   reset() {
      localStorage.removeItem('workouts');
      location.reload();
   }

   _deleteWorkout(e) {
      if (e.target.className !== 'btn-delete') return;

      const selectedWorkout = this.#workouts.find(
         workout => workout.id === e.target.closest('.workout').id
      );
      const index = this.#workouts.indexOf(selectedWorkout);
      this.#workouts.splice(index, 1);
      console.log(this.#workouts);

      this._setLocalStorage();
      location.reload();
   }
}

///////////////////////////////////////////////////

const app = new App();
