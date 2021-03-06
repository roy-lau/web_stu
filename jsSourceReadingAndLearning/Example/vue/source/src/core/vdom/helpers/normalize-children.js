/* @flow */

import VNode, { createTextVNode } from 'core/vdom/vnode'
import { isFalse, isTrue, isDef, isUndef, isPrimitive } from 'shared/util'

// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.
//
// For plain HTML markup, normalization can be completely skipped because the
// generated render function is guaranteed to return Array<VNode>. There are
// two cases where extra normalization is needed:

// 1. When the children contains components - because a functional component
// may return an Array instead of a single root. In this case, just a simple
// normalization is needed - if any child is an Array, we flatten the whole
// thing with Array.prototype.concat. It is guaranteed to be only 1-level deep
// because functional components already normalize their own children.
/**
 * 简单的平铺数组（二维）
 *
 * @param  {Array} children: any          子节点数组
 * @return {Array}                        铺平后的子节点数组（一维数组）
 * @description
 *   传入的如果是二维数组，将其铺平为一维数组。（不考虑二维以上数组的情况）
 *   一维数组直接返回。
 */
export function simpleNormalizeChildren (children: any) {
  for (let i = 0; i < children.length; i++) {
    if (Array.isArray(children[i])) {
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

// 2. When the children contains constructs that always generated nested Arrays,
// e.g. <template>, <slot>, v-for, or when the children is provided by user
// with hand-written render functions / JSX. In such cases a full normalization
// is needed to cater to all possible types of children values.
/*
    判断传入的 `children` 是不是基础类型，如果是基础类型， 返回一个一维数组的文本`VNode`。
    如果不是基础类型，判断 `children` 是不是个数组， 如果是数组调用 `normalizeArrayChildren`函数。
    否则返回 `undefined`
 */
export function normalizeChildren (children: any): ?Array<VNode> {
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : Array.isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}

function isTextNode (node): boolean {
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

function normalizeArrayChildren (children: any, nestedIndex?: string): Array<VNode> {
  // 定义 res 常量是一个数组
  const res = []
  let i, c, lastIndex, last
  // 遍历 `children`
  for (i = 0; i < children.length; i++) {
    c = children[i]
    if (isUndef(c) || typeof c === 'boolean') continue
    lastIndex = res.length - 1
    last = res[lastIndex]
    //  nested
    /**
     *
     * 1. 先判断 `children` 是不是一个数组，如果是个数组，就将其递归展开。
     * 2. 如果不是一个数组而是基础类型。
     *     判断是不是 `TextNode` ，如果是 `TextNode` 将两个 `VNode` 合并
     *     如果 `children` 不是字符串，则创建个 `VNode` 文本节点
     * 3. 否则，`children` 就是一个正常的 `VNode`。
     *     判断`children`是不是 `TextNode` ，如果是 `TextNode` 将两个 `VNode` 合并
     *     否则，对 `children`的属性(v-for v-show v-bind…… )进行一些处理
     *
     * 最后返回 res
     */
    if (Array.isArray(c)) {
      if (c.length > 0) {
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // merge adjacent text nodes
        if (isTextNode(c[0]) && isTextNode(last)) {
          res[lastIndex] = createTextVNode(last.text + (c[0]: any).text)
          c.shift()
        }
        res.push.apply(res, c)
      }
    } else if (isPrimitive(c)) {
      if (isTextNode(last)) {
        // merge adjacent text nodes
        // this is necessary for SSR hydration because text nodes are
        // essentially merged when rendered to HTML strings
        res[lastIndex] = createTextVNode(last.text + c)
      } else if (c !== '') {
        // convert primitive to vnode
        res.push(createTextVNode(c))
      }
    } else {
      if (isTextNode(c) && isTextNode(last)) {
        // merge adjacent text nodes
        res[lastIndex] = createTextVNode(last.text + c.text)
      } else {
        // default key for nested array children (likely generated by v-for)
        if (isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)) {
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        res.push(c)
      }
    }
  }
  return res
}
