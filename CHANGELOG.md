# Changelog

## [0.3.0](https://github.com/jnnkls/gym-trackr/compare/v0.2.0...v0.3.0) (2026-11-19)


### Features

* **card:** edit visits from a day dialog and mushroom-style buttons ([#5](https://github.com/jnnkls/gym-trackr/issues/5)) ([e222947](https://github.com/jnnkls/gym-trackr/commit/e22294724dc6b2df8c44778a0c3b6a044ee9d6c6))


### Bug Fixes

* **blueprint:** treat input_datetime's midnight default as no open visit ([#4](https://github.com/jnnkls/gym-trackr/issues/4)) ([9893a45](https://github.com/jnnkls/gym-trackr/commit/9893a4563e94ad4c1e4919efefa6a63701507660))

## [0.2.0](https://github.com/jnnkls/gym-trackr/compare/v0.1.0...v0.2.0) (2026-11-19)


### Features

* add gym visit automation blueprint ([e330c49](https://github.com/jnnkls/gym-trackr/commit/e330c493bc3768da2c176b4cddba2ce424bbc03c))
* add gym-trackr lovelace card ([3e8059e](https://github.com/jnnkls/gym-trackr/commit/3e8059e63fcda6075f32a14266f671532a84769b))
* add heatmap aggregation logic ([08725fd](https://github.com/jnnkls/gym-trackr/commit/08725fd8b2e6eba243853fef702a08febdd73385))
* **card:** default to 90-day view and green colours ([#3](https://github.com/jnnkls/gym-trackr/issues/3)) ([19b3264](https://github.com/jnnkls/gym-trackr/commit/19b3264925ee57fd30516f83eef275d3ef0d09e4))


### Bug Fixes

* back off 30 s after calendar fetch errors ([d9cf4fd](https://github.com/jnnkls/gym-trackr/commit/d9cf4fd908f6faf849fe8c9a2da6180adc4ebef2))
* **blueprint:** harden visit handling against corrupt state, restarts and DST ([1a370f8](https://github.com/jnnkls/gym-trackr/commit/1a370f8ddc6395d1b927c5df3a7f079fb85e6aff))
* **card:** survive malformed calendar data, validate entity, ignore stale responses ([4ff05ba](https://github.com/jnnkls/gym-trackr/commit/4ff05ba0321d77830ec04c734c7020685a79784b))
* make blueprint tests reach start and leave-cap paths, treat unknown helper as closed ([b8166e9](https://github.com/jnnkls/gym-trackr/commit/b8166e9df829df30caaab4eca117f7f53f7bd855))
