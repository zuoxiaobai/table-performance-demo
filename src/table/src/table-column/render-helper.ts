// @ts-nocheck
import {
  Comment,
  computed,
  getCurrentInstance,
  h,
  ref,
  unref,
  watchEffect,
} from 'vue'
import { debugWarn } from 'element-plus/es/utils/index'
import { useNamespace } from 'element-plus/es/hooks/index'
import {
  cellForced,
  defaultRenderCell,
  getDefaultClassName,
  treeCellPrefix,
} from '../config'
import { parseMinWidth, parseWidth } from '../util'
import type { ComputedRef } from 'vue'
import type { TableColumn, TableColumnCtx } from './defaults'

function useRender<T>(
  props: TableColumnCtx<T>,
  slots,
  owner: ComputedRef<any>
) {
  const instance = getCurrentInstance() as TableColumn<T>
  const columnId = ref('')
  const isSubColumn = ref(false)
  const realAlign = ref<string>()
  const realHeaderAlign = ref<string>()
  const ns = useNamespace('table')
  watchEffect(() => {
    realAlign.value = props.align ? `is-${props.align}` : null
    // nextline help render
    realAlign.value
  })
  watchEffect(() => {
    realHeaderAlign.value = props.headerAlign
      ? `is-${props.headerAlign}`
      : realAlign.value
    // nextline help render
    realHeaderAlign.value
  })
  const columnOrTableParent = computed(() => {
    let parent: any = instance.vnode.vParent || instance.parent
    while (parent && !parent.tableId && !parent.columnId) {
      parent = parent.vnode.vParent || parent.parent
    }
    return parent
  })
  const hasTreeColumn = computed<boolean>(() => {
    const { store } = instance.parent
    if (!store) return false
    const { treeData } = store.states
    const treeDataValue = treeData.value
    return treeDataValue && Object.keys(treeDataValue).length > 0
  })

  const realWidth = ref(parseWidth(props.width))
  const realMinWidth = ref(parseMinWidth(props.minWidth))
  const setColumnWidth = (column: TableColumnCtx<T>) => {
    if (realWidth.value) column.width = realWidth.value
    if (realMinWidth.value) {
      column.minWidth = realMinWidth.value
    }
    if (!realWidth.value && realMinWidth.value) {
      column.width = undefined
    }
    if (!column.minWidth) {
      column.minWidth = 80
    }
    column.realWidth = Number(
      column.width === undefined ? column.minWidth : column.width
    )
    return column
  }
  const setColumnForcedProps = (column: TableColumnCtx<T>) => {
    // ????????????????????? column??????????????????????????????
    const type = column.type
    const source = cellForced[type] || {}
    Object.keys(source).forEach((prop) => {
      const value = source[prop]
      if (prop !== 'className' && value !== undefined) {
        column[prop] = value
      }
    })
    const className = getDefaultClassName(type)
    if (className) {
      const forceClass = `${unref(ns.namespace)}-${className}`
      column.className = column.className
        ? `${column.className} ${forceClass}`
        : forceClass
    }
    return column
  }

  const checkSubColumn = (children: TableColumn<T> | TableColumn<T>[]) => {
    if (Array.isArray(children)) {
      children.forEach((child) => check(child))
    } else {
      check(children)
    }
    function check(item: TableColumn<T>) {
      if (item?.type?.name === 'ElTableColumn') {
        item.vParent = instance
      }
    }
  }
  const setColumnRenders = (column: TableColumnCtx<T>) => {
    // renderHeader ????????????????????????
    if (props.renderHeader) {
      debugWarn(
        'TableColumn',
        'Comparing to render-header, scoped-slot header is easier to use. We recommend users to use scoped-slot header.'
      )
    } else if (column.type !== 'selection') {
      column.renderHeader = (scope) => {
        // help render
        instance.columnConfig.value['label']
        const renderHeader = slots.header
        return renderHeader ? renderHeader(scope) : column.label
      }
    }

    let originRenderCell = column.renderCell
    // TODO: ?????????????????????
    if (column.type === 'expand') {
      // ??????????????????renderCell ???????????????????????????????????????????????????????????????????????????????????????
      column.renderCell = (data) =>
        h(
          'div',
          {
            class: 'cell',
          },
          [originRenderCell(data)]
        )
      owner.value.renderExpanded = (data) => {
        return slots.default ? slots.default(data) : slots.default
      }
    } else {
      originRenderCell = originRenderCell || defaultRenderCell
      // ??? renderCell ????????????
      column.renderCell = (data) => {
        let children = null
        if (slots.default) {
          const vnodes = slots.default(data)
          children = vnodes.some((v) => v.type !== Comment)
            ? vnodes
            : originRenderCell(data)
        } else {
          children = originRenderCell(data)
        }
        const shouldCreatePlaceholder =
          hasTreeColumn.value &&
          data.cellIndex === 0 &&
          data.column.type !== 'selection'
        const prefix = treeCellPrefix(data, shouldCreatePlaceholder)
        const props = {
          class: 'cell',
          style: {},
        }
        if (column.showOverflowTooltip) {
          props.class = `${props.class} ${unref(ns.namespace)}-tooltip`
          props.style = {
            width: `${
              (data.column.realWidth || Number(data.column.width)) - 1
            }px`,
          }
        }
        checkSubColumn(children)
        return h('div', props, [prefix, children])
      }
    }
    return column
  }
  const getPropsData = (...propsKey: unknown[]) => {
    return propsKey.reduce((prev, cur) => {
      if (Array.isArray(cur)) {
        cur.forEach((key) => {
          prev[key] = props[key]
        })
      }
      return prev
    }, {})
  }
  const getColumnElIndex = (children, child) => {
    return Array.prototype.indexOf.call(children, child)
  }

  return {
    columnId,
    realAlign,
    isSubColumn,
    realHeaderAlign,
    columnOrTableParent,
    setColumnWidth,
    setColumnForcedProps,
    setColumnRenders,
    getPropsData,
    getColumnElIndex,
  }
}

export default useRender
